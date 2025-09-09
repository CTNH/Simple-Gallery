from src.database.db import Database
from pathlib import Path
from src.media.metadataExtract import MetaExtract
from os import fspath, getcwd
from src.utils.filehash import SHA1
from os.path import join as pathJoin
from os.path import basename
from src.media.thumbnails import ImgThumbnail, VidThumbnail
from src.media.mediatype import MediaType, GetMediaType
from src.utils.paths import CreatePath
import tomllib
from .app import Run


def initialize(config: dict):
    MEDIA_PATH = config["paths"]["media"]
    DATA_PATH = config["paths"]["data"]
    DATABASE_NAME = "gallery.db"
    THUMBNAIL_PATH = pathJoin(DATA_PATH, "thumbnails")
    THUMBNAIL_SIZES = config["media"]["thumbnail_size"]

    HASH_METHOD = SHA1
    CreatePath(DATA_PATH)
    db = Database(pathJoin(DATA_PATH, DATABASE_NAME))
    COMMIT_BATCH_SIZE = config["database"]["commit_batch_size"]
    batchSize = 0
    # Recursively list all files
    for fpath in list(Path(MEDIA_PATH).rglob('*')):
        mediaPath = fspath(fpath)
        metadata = MetaExtract(mediaPath)
        # Not supported; skip
        if metadata is None:
            continue

        # print(f"Processing {fpath}")
        metadata['hash'] = HASH_METHOD(mediaPath)
        metadata['path'] = mediaPath
        metadata['ratio'] = metadata['width'] / metadata['height']
        print("Generating thumbnail")
        for tSize in THUMBNAIL_SIZES:
            thumbnailPath = pathJoin(
                THUMBNAIL_PATH,
                metadata['hash'][:2],
                metadata['hash'][2:4],
                metadata['hash'][4:] + f"-{tSize}.jpg"
            )

            mtype = GetMediaType(mediaPath)
            if mtype is MediaType.IMAGE:
                ImgThumbnail(mediaPath, thumbnailPath, (tSize, tSize))
            elif mtype is MediaType.VIDEO:
                VidThumbnail(mediaPath, thumbnailPath, tSize)

        db.addImage(metadata)

        batchSize += 1
        # Write changes to disk in batch
        if batchSize >= COMMIT_BATCH_SIZE:
            db.commit()
            batchSize = 0
    # Last batch
    db.commit()


# Entry point
def main():
    with open("config/config.toml", "rb") as f:
        config = tomllib.load(f)

    init = False
    if init:
        initialize(config)
    else:
        CreatePath(config["paths"]["data"])
        db = Database(pathJoin(config["paths"]["data"], "gallery.db"))

        imgs = {
            'info': [],
            'path': {}
        }
        for row in db.getImages():
            # hash, path, date, size, ratio, width, height, video, duration
            fname = f'{row[0][4:]}-{config["media"]["thumbnail_size"][0]}.jpg'
            fpath = pathJoin(row[0][:2], row[0][2:4], fname)

            imgInfo = {
                'hash': row[0],
                'name': basename(row[1]),
                'aspectRatio': row[4],
                'video': row[7]
            }
            if imgInfo['video'] == 1:
                imgInfo['duration'] = row[8]
            imgs['info'].append(imgInfo)
            imgs['path'][row[0]] = {
                'thumbnail': fpath,
                'original': row[1]
            }

        thumbnailsFolder = pathJoin(config["paths"]["data"], "thumbnails")
        # Set to absolute path if is relative
        if not thumbnailsFolder.startswith('/'):
            thumbnailsFolder = pathJoin(getcwd(), thumbnailsFolder)

        Run(
            config['server']['host'], config['server']['port'],
            thumbnailsFolder, imgs
        )


if __name__ == "__main__":
    main()
