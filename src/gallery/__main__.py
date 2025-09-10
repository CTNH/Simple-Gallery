from pathlib import Path
from os import fspath, getcwd
from os.path import join as pathJoin
from os.path import basename, exists
from src.database import schema
from src.database.db import Database
from src.media.metadataExtract import MetaExtract
from src.media.thumbnails import ImgThumbnail, VidThumbnail
from src.media.mediatype import MediaType, GetMediaType
from src.utils.filehash import SHA1
from src.utils.paths import CreatePath
from .app import Run
import tomllib
from collections import defaultdict
import argparse


def thumbnailPath(hash: str, size: int) -> (str, str):
    return (
        f'{hash[:2]}/{hash[2:4]}/',
        f'{hash[4:]}-{size}.jpg'
    )


def initialize(config: dict):
    MEDIA_PATH = config["paths"]["media"]
    DATA_PATH = config["paths"]["data"]
    DATABASE_NAME = "gallery.db"
    THUMBNAIL_PATH = pathJoin(DATA_PATH, "thumbnails")
    THUMBNAIL_SIZES = config["media"]["thumbnail_size"]

    HASH_METHOD = SHA1

    CreatePath(DATA_PATH)
    db = Database(pathJoin(DATA_PATH, DATABASE_NAME))
    for statement in schema.CREATE_TABLES:
        if (e := db.exec(statement).get('DB_EXEC_ERR')):
            print(f"Error creating tables: {e}")
            return

    COMMIT_BATCH_SIZE = config["database"]["commit_batch_size"]
    batchSize = 0
    failedInserts, inserts = 0, 0

    # Recursively list all files
    for fpath in list(Path(MEDIA_PATH).rglob('*')):
        mediaPath = fspath(fpath)
        metadata = MetaExtract(mediaPath)
        # Not supported; skip
        if metadata is None:
            continue

        hash = HASH_METHOD(mediaPath)
        metadata['hash'] = hash
        metadata['path'] = mediaPath
        metadata['ratio'] = metadata['width'] / metadata['height']

        print("Generating thumbnail")
        for tSize in THUMBNAIL_SIZES:
            tpath = pathJoin(
                THUMBNAIL_PATH,
                ''.join(thumbnailPath(hash, tSize))
            )
            if exists(tpath):
                print("Thumbnail exists, skipping...")
                continue

            {
                MediaType.IMAGE: ImgThumbnail,
                MediaType.VIDEO: VidThumbnail
            }[GetMediaType(mediaPath)](
                # Arguments to thumbnailer
                mediaPath,
                tpath,
                tSize
            )

        for statement in schema.INSERT_IMAGES:
            if (
                db.exec(statement, defaultdict(lambda: None, metadata))
                .get('DB_EXEC_ERR')
            ):
                failedInserts += 1
            else:
                inserts += 1

        batchSize += 1
        # Write changes to disk in batch
        if batchSize >= COMMIT_BATCH_SIZE:
            db.commit()
            batchSize = 0
    # Last batch
    db.commit()

    print(f"{inserts} inserts, {failedInserts} failed.")


def server(config: dict):
    CreatePath(config["paths"]["data"])
    db = Database(pathJoin(config["paths"]["data"], "gallery.db"))

    imgs = {
        'info': [],
        'path': {}
    }
    for row in db.exec(schema.GET_MEDIA_LIST):
        imgs['info'].append({
            'hash': row['hash'],
            'name': basename(row['path']),
            'aspectRatio': row['ratio'],
            'video': row['video'],
            'duration': row['duration']
        })
        imgs['path'][row['hash']] = {
            'thumbnail': ''.join(thumbnailPath(
                row['hash'],
                min(config["media"]["thumbnail_size"])
            )),
            'original': row['path']
        }

    thumbnailsFolder = pathJoin(config["paths"]["data"], "thumbnails")
    # Set to absolute path if is relative
    if not thumbnailsFolder.startswith('/'):
        thumbnailsFolder = pathJoin(getcwd(), thumbnailsFolder)

    Run(
        thumbnailsFolder, imgs,
        config['server']['host'], config['server']['port']
    )


# Entry point
def main():
    parser = argparse.ArgumentParser(description="Simple Gallery")
    parser.add_argument(
        "-c", "--config",
        type=str, default="config/config.toml",
        help="Location of config file"
    )
    parser.add_argument(
        "-i", "--init",
        action="store_true",
        help="Run in init mode"
    )
    args = parser.parse_args()

    if not exists(args.config):
        print(f"Config file '{args.config}' not found!")
        return

    with open(args.config, "rb") as f:
        config = tomllib.load(f)

    if args.init:
        print("Running initialization.")
        initialize(config)
        return

    server(config)


if __name__ == "__main__":
    main()
