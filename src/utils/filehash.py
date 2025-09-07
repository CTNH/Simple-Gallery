import hashlib

def SHA1(fpath):
    h = hashlib.sha1()
    with open(fpath, 'rb') as f:
        chunk = f.read(1024)
        while chunk:
            h.update(chunk)
            chunk = f.read(1024)
    return h.hexdigest()

