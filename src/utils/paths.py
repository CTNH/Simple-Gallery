from os.path import dirname, exists
from os import makedirs


# Ensure the output directory exists, create if necessary
def CreatePath(newPath):
    output_dir = dirname(newPath)
    if output_dir and not exists(output_dir):
        makedirs(output_dir, exist_ok=True)
