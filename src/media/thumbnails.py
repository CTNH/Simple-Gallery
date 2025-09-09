from PIL import Image
from pillow_heif import register_heif_opener
from src.utils.paths import CreatePath
import ffmpeg


# Support for HEIF formats
register_heif_opener()


def ImgThumbnail(imgPath: str, thumbnailPath: str, size: tuple[int, int]):
    # Copy of original to prevent modification
    img = Image.open(imgPath).copy()
    w, h = img.width, img.height
    if w < h:
        size = int((h / w) * size[0])
    else:
        size = int((w / h) * size[0])
    img.thumbnail((size, size))

    CreatePath(thumbnailPath)

    # Disgard alpha channel in case of jpg
    img = img.convert("RGB")
    img.save(thumbnailPath)


def VidThumbnail(vidPath: str, thumbnailPath: str, size: int):
    CreatePath(thumbnailPath)

    (
        ffmpeg
        .input(vidPath)
        # Split stream for thumbnail filtering
        .filter_multi_output('split')[0]
        # Select representative frame
        .filter('thumbnail')
        # Set shorter side to size and keep aspect ratio
        .filter(
            'scale',
            w='if(gt(iw,ih),-1,{0})'.format(size),
            h='if(gt(iw,ih),{0},-1)'.format(size)
        )
        # Output single frame
        .output(thumbnailPath, vframes=1)
        .run(capture_stdout=True, capture_stderr=True)
    )
