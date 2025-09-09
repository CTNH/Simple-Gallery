from PIL import Image
from pillow_heif import register_heif_opener
from os.path import getctime, getmtime, getsize
from datetime import datetime as dt
import exifread
from src.media.mediatype import MediaType, GetMediaType
import ffmpeg


# Support for HEIF formats
register_heif_opener()


def MetaExtract(fpath: str) -> dict:
    mtype = GetMediaType(fpath)

    # Neither
    if mtype == MediaType.OTHER:
        return None

    print(f"Getting metadata for {fpath}")

    # Images
    if mtype == MediaType.IMAGE:
        img = Image.open(fpath)
        # Basic metadata
        data = {
            'size': getsize(fpath),
            "height": img.height,
            "width": img.width,
            'video': 0,
            "animated": getattr(img, "is_animated", False),
            "frames": getattr(img, "n_frames", 1)
        }
        # EXIF metadata
        exifdata = {}
        with open(fpath, 'rb') as f:
            tags = exifread.process_file(f, details=False)
            for tag in tags:
                exifdata[tag.split(" ")[1]] = tags[tag]

        fileTime = min(getctime(fpath), getmtime(fpath))
        imgDatetime = exifdata.get(0x0132)
        # Fallback to UTC timezone
        imgOffsettime = exifdata.get(0x9010, "+0000")
        # No EXIF for datetime
        if imgDatetime is None:
            data['DateTime'] = fileTime
        else:
            data["DateTime"] = dt.strptime(
                f"{imgDatetime} {imgOffsettime}",
                "%Y:%m:%d %H:%M:%S %z"
            ).timestamp()

        return data

    # Videos
    elif mtype == MediaType.VIDEO:
        try:
            metadata = ffmpeg.probe(fpath)
            vidStreamMeta = next(
                (s for s in metadata['streams'] if s['codec_type'] == 'video'),
                None
            )

            # No video stream
            if not vidStreamMeta:
                return None

            out = {
                'width': vidStreamMeta['width'],
                'height': vidStreamMeta['height'],
                'size': getsize(fpath),
                'video': 1
            }
            # Swap width and height if portrait
            rotation = 0
            for side_data in vidStreamMeta.get('side_data_list', []):
                if side_data.get('side_data_type') == 'Display Matrix':
                    rotation = abs(int(side_data.get('rotation', 0)))
            if rotation == 90 or rotation == 270:
                out['width'], out['height'] = out['height'], out['width']

            if 'creation_time' in vidStreamMeta['tags']:
                out['DateTime'] = dt.strptime(
                    vidStreamMeta['tags']['creation_time'],
                    "%Y-%m-%dT%H:%M:%S.%fZ"
                ).timestamp()
            else:
                out['DateTime'] = min(getctime(fpath), getmtime(fpath))

            return out
        except ffmpeg.Error as e:
            print(f'Error probing video: {e.stderr.decode()}')
            return None
