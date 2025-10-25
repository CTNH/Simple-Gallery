# Simple Image Gallery
A self hosted web gallery to browse personal media. Heavily inspired by [home-gallery](https://github.com/xemle/home-gallery), this project aims to be a more lightweight and simple alternative, while using database files over just plain json.

Work in progress.

## Setup
Create virtual environment and install dependencies in Python. Dependencies are listed in [pyproject.toml](./pyproject.toml).
```sh
python3 -m venv ./gallery_venv
source ./gallery_venv/bin/activate
pip install -e .
```

## Configuration
The configuration uses a single TOML file. A default file is provided at [config/default.toml](config/default.toml).

- The paths can be absolute or relative, but needs to end with slash `/`.
- Put the config file anywhere you want; specify the path at runtime with `-c`.

## Usage
The entry point is in the *gallery* module.
- Source the virtual environment
```sh
source <path>/<to>/<venv>
python3 -m gallery ...
```
or
- Use Python from environment directly
```sh
<path>/<to>/<venv>/python3 -m gallery ...
```

Currently the process of initializing database and generating thumbnails requires running init mode independently first:
```sh
# Use -i for init mode
gallery -c config.toml -i
```
A `gallery.db` file and `thumbnails` directory should be created in the `paths.data` directory provided in config.toml.

Finally start the server:
```sh
gallery -c config.toml
```
Then open your browser at [localhost:5000](http://localhost:5000) (default) to browse your gallery.

