from flask import Flask, render_template, send_from_directory, send_file, abort
from flask import Response, make_response, jsonify, request as frequest
from os.path import isabs, join as pathJoin, exists, basename, abspath
from gallery.extensions import db
from gallery.models import Media, MediaPath, MediaTag

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
    thumbnailSize: int
) -> Flask:
    if not exists(dbPath):
        print(f'Database file {dbPath} not found.')
        return

    def thumbnailPath(hash: str) -> (str, str):
        return (
            f'{hash[:2]}/{hash[2:4]}/',
            f'{hash[4:]}-{thumbnailSize}.jpg'
        )

    def getMediaInfo(pathFilter: str = None):
        rows = db.session.query(
            Media.hash,
            MediaPath.path,
            Media.aspectratio,
            Media.video,
            Media.duration,
            Media.rotation,
            Media.width,
            Media.height,
            Media.size
        ).join(MediaPath.media)
        if pathFilter is not None:
            rows = rows.filter(
                MediaPath.path.like(pathFilter)
            )
        return rows.order_by(Media.datetime).all()

    app.config['thumbnailDir'] = thumbnailFolder
    app.config['configDir'] = configFolder

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
                'thumbnail': ''.join(thumbnailPath(row[0])),
                'original': row[1]
            }

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
        pathFilter = frequest.args.get('path', default=None)
        if pathFilter is None:
            return jsonify(app.config['mediaInfo'])

        with app.app_context():
            # Get media list from database
            rows = getMediaInfo(f"{pathFilter}%")

            mediaInfo = []
            for row in rows:
                mediaInfo.append({
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
            return jsonify(mediaInfo)

    def cachedResp(resp: Response) -> Response:
        resp = make_response(resp)
        resp.headers['Cache-Control'] = 'public, max-age=86400, immutable'
        return resp

    @app.route('/files/<hash>/thumbnail')
    def serve_thumbnail(hash):
        if hash not in app.config['mediaPath']:
            abort(404)
        return cachedResp(send_from_directory(
            abspath(app.config['thumbnailDir']),
            app.config['mediaPath'][hash]['thumbnail']
        ))

    @app.route('/files/<hash>/original')
    def serve_originalMedia(hash):
        if hash not in app.config['mediaPath']:
            abort(404)

        original_path = app.config['mediaPath'][hash]['original']
        # Path is relative
        if not isabs(original_path):
            # Convert to absolute path based on current working directory
            original_path = pathJoin(
                app.config['configDir'],
                original_path
            )
        return cachedResp(send_file(original_path))

    @app.route(
        '/api/rotate/<string:hash>/<string:direction>',
        methods=['POST']
    )
    def rotateImage(hash, direction):
        media = Media.query.filter_by(hash=hash).first()
        directions = {
            'right': 90,
            'left': -90,
        }
        if not media or direction not in directions:
            return jsonify({
                "success": False,
                "msg": f"Failed to rotate {hash} {direction}"
            })

        media.rotation = ((media.rotation or 0) + directions[direction]) % 360
        db.session.commit()

        # Rotate current session
        for m in app.config['mediaInfo']:
            if m['hash'] == hash:
                m['rotation'] = media.rotation
                break

        return jsonify({
            "success": True,
            "msg": f"Rotated {hash} {direction}"
        })

    @app.route('/api/tags', methods=['POST'])
    def addTag():
        data = frequest.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No JSON data received'
            }), 400

        tags = data.get('tag', [])
        hashes = data.get('hashes', [])
        app.config['mediaPath'] = MediaTag.query.all()
        rows = []
        for tag in tags:
            mediaWithTag = MediaTag.query.with_entities(MediaTag.hash).filter_by(tag=tag).all()
            mediaWithTag = [m for (m,) in mediaWithTag]
            for hash in hashes:
                if hash in mediaWithTag:
                    continue
                rows.append(MediaTag(
                    hash=hash,
                    tag=tag
                ))
        db.session.add_all(rows)
        db.session.commit()

        return jsonify({
            'success': True,
        }), 200

    return app
