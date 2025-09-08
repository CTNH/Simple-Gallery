from src.database.db import Database
from pathlib import Path
from src.media.metadataExtract import MetaExtract
from os import fspath
from src.utils.filehash import SHA1


# Entry point
def main():
    db = Database("gallery.db")

    MEDIA_PATH = "./images/"

    # Recursively list all files
    for fpath in list(Path(MEDIA_PATH).rglob('*')):
        metadata = MetaExtract(fspath(fpath))
        # Not supported; skip
        if metadata is None:
            continue

        metadata['sha1'] = SHA1(fspath(fpath))
        metadata['path'] = fspath(fpath)
        db.addImage(metadata)

    # Write changes to disk
    db.commit()


if __name__ == "__main__":
    main()
