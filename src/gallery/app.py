from flask import Flask, render_template, send_from_directory, send_file, abort
from flask import Response, make_response, jsonify

app = Flask(__name__)

# Configuration
MEDIA_FOLDER = None
MEDIA = []


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
    return jsonify(MEDIA['info'])


def cachedResp(resp: Response) -> Response:
    resp = make_response(resp)
    resp.headers['Cache-Control'] = 'public, max-age=86400, immutable'
    return resp


@app.route('/files/<hash>/thumbnail')
def serve_thumbnail(hash):
    if hash in MEDIA['path']:
        return cachedResp(send_from_directory(
            MEDIA_FOLDER,
            MEDIA['path'][hash]['thumbnail']
        ))
    else:
        abort(404)


@app.route('/files/<hash>/original')
def serve_originalMedia(hash):
    if hash in MEDIA['path']:
        return cachedResp(send_file(
            MEDIA['path'][hash]['original']
        ))
    else:
        abort(404)


def Run(
    mediaFolder: str,
    media: list,
    host: str = '127.0.0.1',
    port: int = 5000
):
    global MEDIA, MEDIA_FOLDER
    MEDIA_FOLDER = mediaFolder
    MEDIA = media

    print("Starting Gallery Webserver")
    print("=" * 50)

    app.run(debug=True, host=host, port=port)


if __name__ == '__main__':
    Run()
