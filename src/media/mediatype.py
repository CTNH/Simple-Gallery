from enum import Enum


class MediaType(Enum):
    OTHER = 0
    IMAGE = 1
    VIDEO = 2


IMG_EXT = [
    ".jpg", ".jpeg",
    ".png",
    ".webp",
    ".heif", ".heic",
    ".gif",
    ".bmp"
]
VID_EXT = [
    ".mov",
    ".mp4",
    ".webm",
    ".mkv"
]


def GetMediaType(fpath: str) -> MediaType:
    # Extension of file
    ext = fpath[fpath.rfind("."):].lower()

    if ext in IMG_EXT:
        return MediaType.IMAGE
    if ext in VID_EXT:
        return MediaType.VIDEO

    return MediaType.OTHER
