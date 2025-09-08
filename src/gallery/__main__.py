from src.database.db import Database
from pathlib import Path
from src.media.metadataExtract import MetaExtract
from os import fspath
from src.utils.filehash import SHA1
from os.path import join as pathJoin
from src.media.thumbnails import ImgThumbnail
from src.media.mediatype import MediaType, GetMediaType
from src.utils.paths import CreatePath
import tomllib


# Entry point
def main():
    with open("config/config.toml", "rb") as f:
        config = tomllib.load(f)

    MEDIA_PATH = config["paths"]["media"]
    DATA_PATH = config["paths"]["data"]
    DATABASE_NAME = "gallery.db"
    THUMBNAIL_PATH = pathJoin(DATA_PATH, "thumbnails")
    THUMBNAIL_SIZES = config["media"]["thumbnail_size"]

    HASH_METHOD = SHA1

    CreatePath(DATA_PATH)

    db = Database(pathJoin(DATA_PATH, DATABASE_NAME))
    # Recursively list all files
    for fpath in list(Path(MEDIA_PATH).rglob('*')):
        mediaPath = fspath(fpath)
        metadata = MetaExtract(mediaPath)
        # Not supported; skip
        if metadata is None:
            continue

        print(f"Processing {fpath}")
        metadata['hash'] = HASH_METHOD(mediaPath)
        metadata['path'] = mediaPath

        for tSize in THUMBNAIL_SIZES:
            imgThumbnailPath = pathJoin(
                THUMBNAIL_PATH,
                metadata['hash'][:2],
                metadata['hash'][2:4],
                metadata['hash'][4:] + f"-{tSize}.jpg"
            )

            mtype = GetMediaType(mediaPath)
            if mtype is MediaType.IMAGE:
                ImgThumbnail(mediaPath, imgThumbnailPath, (tSize, tSize))
            elif mtype is MediaType.VIDEO:
                pass

        db.addImage(metadata)

    # Write changes to disk
    db.commit()


if __name__ == "__main__":
    main()
