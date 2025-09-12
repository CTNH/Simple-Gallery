from gallery.extensions import db


class Media(db.Model):
    __tablename__ = 'media'
    hash = db.Column(db.String, primary_key=True)

    # Stores as epoch time
    datetime = db.Column(db.Integer)

    # File size
    size = db.Column(db.Integer, nullable=False)

    # Frame width and height
    width = db.Column(db.Integer, nullable=False)
    height = db.Column(db.Integer, nullable=False)

    # Aspect ratio
    aspectratio = db.Column(db.Float, nullable=False)

    # Image or Video
    video = db.Column(db.Boolean, nullable=False)
    duration = db.Column(db.String)

    rotation = db.Column(db.Integer, nullable=True)

    def formattedDuration(self) -> str:
        return self.duration


class MediaPath(db.Model):
    __tablename__ = 'media_path'
    path = db.Column(db.String, primary_key=True)
    hash = db.Column(db.String, db.ForeignKey('media.hash'), nullable=False)
    # Bidirectional access
    media = db.relationship('Media', backref=db.backref('media_paths', lazy=True))
