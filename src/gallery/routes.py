from flask import Blueprint, render_template, send_from_directory, send_file
from flask import abort, request as frequest, make_response, jsonify
from flask import current_app, Response
from os.path import isabs, join as pathJoin, basename, abspath
from models.models import Media, MediaTag
from models import db
from sqlalchemy import distinct
from gallery.media import getMediaInfo
from functools import wraps
from collections import OrderedDict
from re import match as reMatch

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


@bp.route('/lightbox/<hash>')
def lightbox(hash):
    return render_template('gallery.html')


@bp.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory("static", filename)


@bp.route('/api/media')
def get_mediaInfo():
    """API endpoint to get all images with their aspect ratios"""
    pathFilter = frequest.args.get('path', default=None)
    tagsFilter = frequest.args.getlist('tag')
    typeFilter = frequest.args.get('types', default='').split(',')
    cacheKey = (pathFilter, frozenset(tagsFilter), frozenset(typeFilter))
    if typeFilter == ['']:
        typeFilter = None

    if pathFilter is not None:
        pathFilter = f"{pathFilter}%"

    if cacheKey in current_app.config['media_cache']:
        return current_app.config['media_cache'][cacheKey]

    # Get media list from database
    rows = getMediaInfo(
        pathFilter=pathFilter,
        tagsFilter=tagsFilter,
        typeFilter=typeFilter
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
    current_app.config['media_cache'][cacheKey] = jsonify(resp)
    return current_app.config['media_cache'][cacheKey]


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
        original_path = pathJoin(
            current_app.config['configDir'],
            original_path
        )

    # If not video
    media = Media.query.filter_by(hash=hash).first()
    if not media or not media.video:
        return send_file(original_path)

    CHUNK_SIZE = 4 * 1024 * 1024    # 4MB
    rangeHeader = frequest.headers.get('Range', default=None)

    byteStart, byteEnd = 0, 0
    # Default to first chunk with no range header
    if not rangeHeader:
        byteEnd = min(CHUNK_SIZE - 1, media.size - 1)
    else:
        # Parse Range header
        range_match = reMatch(r'bytes=(\d+)-(\d*)', rangeHeader)
        if range_match:
            groups = range_match.groups()
            byteStart = int(groups[0])
            if groups[1]:
                byteEnd = int(groups[1])
            else:
                byteEnd = min(byteStart + CHUNK_SIZE - 1, media.size - 1)
        else:
            # If Range header is malformed
            abort(416)  # Requested Range Not Satisfiable

    contentLength = byteEnd - byteStart + 1
    with open(original_path, 'rb') as f:
        f.seek(byteStart)
        data = f.read(contentLength)

    resp = Response(
        data,
        status=206,
        mimetype='video/mp4',
        direct_passthrough=True
    )
    resp.headers.add(
        'Content-Range',
        f'bytes {byteStart}-{byteEnd}/{media.size}'
    )
    resp.headers.add('Accept-Ranges', 'bytes')
    resp.headers.add('Content-Length', str(contentLength))

    return resp


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
    success, error = safeCommit()
    if not success:
        return jsonify({
            'success': False,
            'msg': error
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


def safeCommit() -> (bool, Exception):
    try:
        db.session.commit()
        return (True, None)
    except Exception as e:
        db.session.rollback()
        return (False, e)


@bp.route('/api/tags', methods=['POST'])
def addTag():
    data = frequest.get_json()
    if not data:
        return jsonify({
            'success': False,
            'error': 'No JSON data received'
        }), 400

    hashes = data.get('hashes', [])
    tags = data.get('tag', [])
    if (
        hashes == [] or
        tags == [] or
        type(hashes) is not list or
        type(tags) is not list
    ):
        return jsonify({
            'success': False,
            'msg': "At least one media and tag must be selected!"
        }), 400
    forbiddenChars = {
        '&', '=', ','
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
    success, error = safeCommit()
    if not success:
        return jsonify({
            'success': False,
            'msg': error
        }), 400

    return jsonify({
        'success': True,
    }), 200


@bp.route('/api/tags', methods=['DELETE'])
def removeTag():
    data = frequest.get_json()
    if not data:
        return jsonify({
            'success': False,
            'error': 'No JSON data received'
        }), 400

    tags = data.get('tags', [])
    if tags == [] or type(tags) is not list:
        return jsonify({
            'success': False,
            'msg': "At least one tag must be provided as a list!"
        }), 400

    for tag in tags:
        db.session.query(MediaTag).filter(MediaTag.tag == tag).delete()
    success, error = safeCommit()
    if not success:
        return jsonify({
            'success': False,
            'msg': error
        }), 400

    return jsonify({
        'success': True,
    }), 200


@bp.route('/api/tags', methods=['PUT'])
def renameTag():
    data = frequest.get_json()
    if not data:
        return jsonify({
            'success': False,
            'error': 'No JSON data received'
        }), 400

    oldTag = data.get('old_tag', None)
    newTag = data.get('new_tag', None)

    if not oldTag or not newTag:
        return jsonify({
            'success': False,
            'msg': "Both old and new tags must be provided!"
        }), 400

    rows = MediaTag.query.filter_by(tag=oldTag).all()

    # Remove existing to prevent primary key collision
    MediaTag.query.filter(
        MediaTag.tag == newTag,
        MediaTag.hash.in_(
            {row.hash for row in rows}
        )
    ).delete(synchronize_session=False)

    for row in rows:
        row.tag = newTag
        db.session.add(row)

    success, error = safeCommit()
    if not success:
        return jsonify({
            'success': False,
            'msg': error
        }), 400

    return jsonify({
        'success': True,
    }), 200
