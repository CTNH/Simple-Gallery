from flask import Flask, render_template, send_from_directory, send_file, abort
from flask import Response, make_response, jsonify
from os.path import isabs, join as pathJoin


def createApp(
    media: list,
    mediaFolder: str,
    configFolder: str
) -> Flask:
    app = Flask(__name__)
    app.config['media'] = media
    app.config['mediaDir'] = mediaFolder
    app.config['configDir'] = configFolder

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
