from flask import Flask, render_template, send_from_directory, send_file, abort
from flask import Response, make_response, jsonify
from os.path import isabs, join as pathJoin
from gallery.extensions import db

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
        from gallery.models import Media, MediaPath
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
        print(f'{hashDupe} hash, {pathDupe} path duplicates not added')


def createApp(
    media: list,
    mediaFolder: str,
    configFolder: str,
    dbPath: str
) -> Flask:
    app.config['media'] = media
    app.config['mediaDir'] = mediaFolder
    app.config['configDir'] = configFolder

    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{dbPath}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)

    @app.route('/')
    def index():
        """Main gallery page"""
        return render_template('gallery.html')

    @app.errorhandler(404)
    def page_not_found(e):
        return render_template('404.html'), 404

    @app.route('/static/<path:filename>')
    def serve_static(filename):
        return send_from_directory("static", filename)

    @app.route('/api/media')
    def get_mediaInfo():
        """API endpoint to get all images with their aspect ratios"""
        return jsonify(app.config['media']['info'])

    def cachedResp(resp: Response) -> Response:
        resp = make_response(resp)
        resp.headers['Cache-Control'] = 'public, max-age=86400, immutable'
        return resp

    @app.route('/files/<hash>/thumbnail')
    def serve_thumbnail(hash):
        if hash in app.config['media']['path']:
            return cachedResp(send_from_directory(
                app.config['mediaDir'],
                app.config['media']['path'][hash]['thumbnail']
            ))
        else:
            abort(404)

    @app.route('/files/<hash>/original')
    def serve_originalMedia(hash):
        if hash in app.config['media']['path']:
            original_path = app.config['media']['path'][hash]['original']
            # Path is relative
            if not isabs(original_path):
                # Convert to absolute path based on current working directory
                original_path = pathJoin(
                    app.config['configDir'],
                    original_path
                )
            return cachedResp(send_file(original_path))
        else:
            abort(404)

    return app
