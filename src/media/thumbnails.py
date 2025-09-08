from PIL import Image
from src.utils.paths import CreatePath


def ImgThumbnail(imgPath: str, thumbnailPath: str, size: tuple[int, int]):
    # Copy of original to prevent modification
    img = Image.open(imgPath).copy()
    img.thumbnail(size)

    CreatePath(thumbnailPath)

    # Disgard alpha channel in case of jpg
    img = img.convert("RGB")
    img.save(thumbnailPath)

