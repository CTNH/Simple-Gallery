from flask import Flask, render_template, send_from_directory, jsonify
import os
from PIL import Image

app = Flask(__name__)

# Configuration
IMAGES_FOLDER = './images/'  # Change this to your image folder path
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
IMAGES = []


@app.route('/')
def index():
    """Main gallery page"""
    return render_template('gallery.html')


@app.route('/api/images')
def get_images():
    """API endpoint to get all images with their aspect ratios"""
    # images = scan_images()
    # return jsonify(images)
    return jsonify(IMAGES)


@app.route('/images/<path:filename>')
def serve_image(filename):
    """Serve individual images from subdirectories"""
    return send_from_directory(IMAGES_FOLDER, filename)


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
    print(f"Media folder: {IMAGES_FOLDER}")
    print("Supported formats: JPG, JPEG, PNG, GIF, BMP, WEBP")
    print("\nStarting server...")

    app.run(debug=True, host=host, port=port)


if __name__ == '__main__':
    Run()
