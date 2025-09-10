from flask import Flask, render_template, send_from_directory, send_file, abort
from flask import Response, make_response, jsonify

app = Flask(__name__)

# Configuration
IMAGES_FOLDER = './images/'  # Change this to your image folder path
IMAGES = []


@app.route('/')
def index():
    """Main gallery page"""
    return render_template('gallery.html')


@app.errorhandler(404)
def page_not_found(e):
    # Render your custom 404.html template and respond with 404 status
    return render_template('404.html'), 404


@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory("static", filename)


@app.route('/api/images')
def get_images():
    """API endpoint to get all images with their aspect ratios"""
    return jsonify(IMAGES['info'])


def cachedResp(resp: Response) -> Response:
    resp = make_response(resp)
    resp.headers['Cache-Control'] = 'public, max-age=86400, immutable'
    return resp


@app.route('/image/<path:hash>')
def serve_image(hash):
    if hash in IMAGES['path']:
        return cachedResp(send_from_directory(
            IMAGES_FOLDER,
            IMAGES['path'][hash]['thumbnail']
        ))
    else:
        abort(404)


@app.route('/originalimage/<path:hash>')
def serve_originalImage(hash):
    if hash in IMAGES['path']:
        return cachedResp(send_file(
            IMAGES['path'][hash]['original']
        ))
    else:
        abort(404)


def Run(
    host: str = '127.0.0.1',
    port: int = 5000,
    imagesFolder: str = IMAGES_FOLDER,
    images: list = IMAGES
):
    global IMAGES, IMAGES_FOLDER
    IMAGES_FOLDER = imagesFolder
    IMAGES = images

    print("Starting Gallery Webserver")
    print("=" * 50)

    app.run(debug=True, host=host, port=port)


if __name__ == '__main__':
    Run()
