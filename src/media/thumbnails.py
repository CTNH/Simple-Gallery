from PIL import Image
from os.path import dirname, exists
from os import makedirs


def ImgThumbnail(imgPath: str, thumbnailPath: str, size: tuple[int, int]):
    # Copy of original to prevent modification
    img = Image.open(imgPath).copy()
    img.thumbnail(size)

    # Ensure the output directory exists, create if necessary
    output_dir = dirname(thumbnailPath)
    if output_dir and not exists(output_dir):
        makedirs(output_dir, exist_ok=True)

    img = img.convert("RGB")
    img.save(thumbnailPath)

