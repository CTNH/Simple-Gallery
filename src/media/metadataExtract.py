from PIL import Image
from pillow_heif import register_heif_opener
from os.path import getctime, getmtime, getsize
from datetime import datetime as dt
from datetime import timezone as tz
import exifread
from src.media.mediatype import MediaType, GetMediaType


# Support for HEIF formats
register_heif_opener()


def MetaExtract(fpath: str) -> dict:
    mtype = GetMediaType(fpath)

    # Images
    if mtype == MediaType.IMAGE:
        img = Image.open(fpath)
        # Basic metadata
        data = {
            "size": img.size,
            "height": img.height,
            "width": img.width,
            "animated": getattr(img, "is_animated", False),
            "frames": getattr(img, "n_frames", 1)
        }
        # EXIF metadata
        with open(fpath, 'rb') as f:
            tags = exifread.process_file(f, details=False)
            for tag in tags:
                data[tag.split(" ")[1]] = tags[tag]

        fileTime = min(getctime(fpath), getmtime(fpath))
        # No EXIF for datetime
        if "DateTime" not in data:
            data["DateTime"] = fileTime
        # Timezone exists
        elif "OffsetTime" in data:
            data["DateTime"] = dt.strptime(
                f"{data["DateTime"]} {data["OffsetTime"]}",
                "%Y:%m:%d %H:%M:%S %z"
            ).timestamp()
        # Datetime exists with no timezone
        else:
            # Convert to epoch
            epochTime = dt.strptime(data["DateTime"], "%Y:%m:%d %H:%M:%S")
            # Set timezone to UTC
            data["DateTime"] = epochTime.replace(tzinfo=tz.utc).timestamp()

        # Replace resolution size to file size
        data["size"] = getsize(fpath)

        return data

    # Videos
    elif mtype == MediaType.VIDEO:
        return None

    # Neither
    else:
        return None
