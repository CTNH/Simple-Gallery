from flask import Flask, render_template
from os.path import exists, basename, abspath
from gallery.extensions import db
from gallery.models import Media, MediaPath
from gallery.routes import bp
from gallery.media import getMediaInfo

app = Flask(__name__)


def initDB(
    dbPath: str,
    data: list,
    commitBatchSize: int
):
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{dbPath}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)

    with app.app_context():
        db.create_all()

        # Get list of hash and paths
        mediaPaths = [p[0] for p in db.session.query(MediaPath.path).all()]
        mediaHashes = [p[0] for p in db.session.query(Media.hash).all()]
        # if already in skip

        currBatchSize = 0
        # Track number of hash and path duplicates
        hashDupe, pathDupe = 0, 0
        rows = []
        for row in data:
            # Only add if not already in db
            if row['hash'] not in mediaHashes:
                rows.append(Media(
                    hash=row['hash'],
                    datetime=row['datetime'],
                    size=row['size'],
                    width=row['width'],
                    height=row['height'],
                    aspectratio=row['aspectratio'],
                    video=row['video'],
                    duration=row['duration'],
                ))
                currBatchSize += 1
                mediaHashes.append(row['hash'])
            else:
                hashDupe += 1
            if row['path'] not in mediaPaths:
                rows.append(MediaPath(
                    path=row['path'],
                    hash=row['hash']
                ))
                currBatchSize += 1
                mediaPaths.append(row['path'])
            else:
                pathDupe += 1

            # Commit in batch
            if currBatchSize >= commitBatchSize:
                db.session.add_all(rows)
                db.session.commit()
                currBatchSize = 0
                rows = []

        db.session.add_all(rows)
        db.session.commit()
        print(f'{hashDupe} hash, {pathDupe} path duplicates not added.')


def createApp(
    thumbnailFolder: str,
    configFolder: str,
    dbPath: str,
    thumbnailSizes: list[int]
) -> Flask:
    if not exists(dbPath):
        print(f'Database file {dbPath} not found.')
        return

    defaultThumbnailSize = min(thumbnailSizes)

    def thumbnailPrefix(hash: str) -> (str, str):
        return (
            f'{hash[:2]}/{hash[2:4]}/',
            f'{hash[4:]}'
        )

    app.config['media_cache'] = {}
    app.config['JSON_SORT_KEYS'] = False

    app.config['thumbnailSizes'] = thumbnailSizes
    app.config['defaultThumbnailSize'] = defaultThumbnailSize
    app.config['thumbnailDir'] = thumbnailFolder
    app.config['configDir'] = abspath(configFolder)

    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{dbPath}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)

    # Create list of media info and paths from database
    with app.app_context():
        rows = getMediaInfo()

        app.config['mediaInfo'] = []
        app.config['mediaPath'] = {}
        for row in rows:
            app.config['mediaInfo'].append({
                'hash': row[0],
                'name': basename(row[1]),
                'aspectRatio': row[2],
                'video': row[3],
                'duration': row[4],
                'rotation': row[5],
                'width': row[6],
                'height': row[7],
                'path': row[1],
                'size': row[8]
            })
            app.config['mediaPath'][row[0]] = {
                'thumbnailPrefix': ''.join(thumbnailPrefix(row[0])),
                'original': row[1]
            }

    app.register_blueprint(bp)

    @app.errorhandler(404)
    def page_not_found(e):
        return render_template('404.html'), 404

    return app
