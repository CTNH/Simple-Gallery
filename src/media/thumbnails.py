from PIL import Image
from src.utils.paths import CreatePath


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
