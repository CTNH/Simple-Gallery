from flask import Blueprint, render_template, send_from_directory, send_file
from flask import abort, request as frequest, make_response, jsonify
from flask import current_app
from os.path import isabs, join as pathJoin, basename, abspath
from gallery.models import Media, MediaTag
from gallery.extensions import db
from sqlalchemy import distinct
from gallery.media import getMediaInfo
from functools import wraps
from collections import OrderedDict

bp = Blueprint('main_routes', __name__)


# Decorator for cache control
def cacheControl(maxAge=86400):
    def decorator(func):
        @wraps(func)    # Preserver original function metadata
        def wrapper(*args, **kwargs):
            resp = make_response(func(*args, **kwargs))
            resp.headers['Cache-Control'] = f'public, max-age={maxAge}'
            return resp
        return wrapper
    return decorator


@bp.route('/')
@bp.route('/search')
def index():
    """Main gallery page"""
    return render_template('gallery.html')


@bp.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory("static", filename)


@bp.route('/api/media')
@cacheControl()
def get_mediaInfo():
    """API endpoint to get all images with their aspect ratios"""
    pathFilter = frequest.args.get('path', default=None)
    tagsFilter = frequest.args.getlist('tag')

    if pathFilter is not None:
        pathFilter = f"{pathFilter}%"

    # Get media list from database
    rows = getMediaInfo(
        pathFilter=pathFilter,
        tagsFilter=tagsFilter
    )

    mediaInfo = OrderedDict()
    for row in rows:
        mediaInfo[row[0]] = {
            'name': basename(row[1]),
            'aspectRatio': row[2],
            'video': row[3],
            'duration': row[4],
            'rotation': row[5],
            'width': row[6],
            'height': row[7],
            'path': row[1],
            'size': row[8]
        }

    resp = {
        'success': True,
        'data': list(mediaInfo.items())
    }
    return jsonify(resp)


@bp.route('/media/<hash>/thumbnail/<tsize>')
@cacheControl()
def serve_sized_thumbnail(hash, tsize):
    try:
        tsize = int(tsize)
    except ValueError:
        abort(404)
    if (
        hash not in current_app.config['mediaPath'] or
        tsize not in current_app.config['thumbnailSizes']
    ):
        abort(404)
    return send_from_directory(
        abspath(current_app.config['thumbnailDir']),
        current_app.config['mediaPath'][hash]['thumbnailPrefix'] +
        f"-{tsize}.jpg"
    )


@bp.route('/media/<hash>/thumbnail')
@cacheControl()
def serve_thumbnail(hash):
    if hash not in current_app.config['mediaPath']:
        abort(404)
    return send_from_directory(
        abspath(current_app.config['thumbnailDir']),
        current_app.config['mediaPath'][hash]['thumbnailPrefix'] +
        f"-{current_app.config['defaultThumbnailSize']}.jpg"
    )


@bp.route('/media/<hash>/original')
@cacheControl()
def serve_originalMedia(hash):
    if hash not in current_app.config['mediaPath']:
        abort(404)

    original_path = current_app.config['mediaPath'][hash]['original']
    # Path is relative
    if not isabs(original_path):
        # Convert to absolute path based on current working directory
        original_path = pathJoin(
            current_app.config['configDir'],
            original_path
        )
    return send_file(original_path)


@bp.route(
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
        }), 400

    media.rotation = ((media.rotation or 0) + directions[direction]) % 360
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'msg': e
        }), 400

    # Rotate current session
    for m in current_app.config['mediaInfo']:
        if m['hash'] == hash:
            m['rotation'] = media.rotation
            break

    return jsonify({
        "success": True,
        "msg": f"Rotated {hash} {direction}"
    })


@bp.route('/api/tags', methods=['GET'])
def getTags():
    hashFilter = frequest.args.get('hash', default=None)
    rows = []
    if hashFilter is None:
        # Get names of all tags
        rows = db.session.query(distinct(MediaTag.tag)).all()
    else:
        rows = (
            MediaTag.query
            .with_entities(MediaTag.tag)
            .filter_by(hash=hashFilter)
            .all()
        )

    return jsonify({
        'success': True,
        'data': [tag for (tag,) in rows]
    })


@bp.route('/api/tags', methods=['POST'])
def addTag():
    data = frequest.get_json()
    if not data:
        return jsonify({
            'success': False,
            'error': 'No JSON data received'
        }), 400

    hashes = data.get('hashes', [])
    if hashes == []:
        return jsonify({
            'success': False,
            'msg': "At least one media must be selected!"
        }), 400
    tags = data.get('tag', [])
    forbiddenChars = {
        '&', '='
    }
    rows = []
    for tag in tags:
        if any(c in tag for c in forbiddenChars):
            return jsonify({
                'success': False,
                'msg': f"Characters {','.join(forbiddenChars)} not allowed!"
            }), 400
        mediaWithTag = (
            MediaTag.query
            .with_entities(MediaTag.hash)
            .filter_by(tag=tag)
            .all()
        )
        mediaWithTag = [m for (m,) in mediaWithTag]
        for hash in hashes:
            if hash in mediaWithTag:
                continue
            rows.append(MediaTag(
                hash=hash,
                tag=tag
            ))
    db.session.add_all(rows)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'msg': e
        }), 400

    return jsonify({
        'success': True,
    }), 200
