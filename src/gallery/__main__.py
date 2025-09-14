from pathlib import Path
from os import fspath
from os.path import join as pathJoin
from os.path import dirname, exists, isabs, normpath
from media.metadataExtract import MetaExtract
from media.thumbnails import ImgThumbnail, VidThumbnail
from media.mediatype import MediaType, GetMediaType
from utils.filehash import SHA1
from utils.paths import CreatePath
from gallery.app import createApp, initDB
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
    # Path is relative
    if not isabs(MEDIA_PATH):
        MEDIA_PATH = pathJoin(config['config_dir'], MEDIA_PATH)

    DATA_PATH = config["paths"]["data"]
    # Path is relative
    if not isabs(DATA_PATH):
        DATA_PATH = pathJoin(config['config_dir'], DATA_PATH)

    DATABASE_NAME = "gallery.db"
    THUMBNAIL_PATH = pathJoin(DATA_PATH, "thumbnails")
    THUMBNAIL_SIZES = config["media"]["thumbnail_size"]

    HASH_METHOD = SHA1

    CreatePath(DATA_PATH)

    MEDIA_PATH_LEN = len(MEDIA_PATH)

    metadataList = []
    # Recursively list all files
    for fpath in list(Path(MEDIA_PATH).rglob('*')):
        mediaPath = fspath(fpath)
        metadata = MetaExtract(mediaPath)
        # Not supported; skip
        if metadata is None:
            continue

        hash = HASH_METHOD(mediaPath)
        metadata['hash'] = hash
        metadata['path'] = pathJoin(
            normpath(config["paths"]["media"]),
            mediaPath[MEDIA_PATH_LEN:]
        )
        metadata['aspectratio'] = metadata['width'] / metadata['height']

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

        metadataList.append(defaultdict(lambda: None, metadata))

    initDB(
        dbPath=pathJoin(DATA_PATH, DATABASE_NAME),
        data=metadataList,
        commitBatchSize=config["database"]["commit_batch_size"]
    )


def server(config: dict):
    dbPath = pathJoin(config["paths"]["data"], "gallery.db")
    # Path is relative
    if not isabs(dbPath):
        dbPath = pathJoin(config['config_dir'], dbPath)

    if not exists(dbPath):
        print(f'Cannot find database file "{dbPath}".')
        return

    thumbnailsFolder = pathJoin(config["paths"]["data"], "thumbnails")
    # Set to absolute path if is relative
    if not isabs(thumbnailsFolder):
        thumbnailsFolder = pathJoin(config['config_dir'], thumbnailsFolder)

    createApp(
        mediaFolder=thumbnailsFolder,
        configFolder=config['config_dir'],
        dbPath=dbPath,
        thumbnailSize=min(config["media"]["thumbnail_size"])
    ).run(
        debug=True,
        host=config['server']['host'],
        port=config['server']['port']
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
    config['config_dir'] = dirname(args.config)

    if args.init:
        print("Running initialization.")
        initialize(config)
        return

    server(config)


if __name__ == "__main__":
    main()
