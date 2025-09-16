from gallery.models import Media, MediaPath, MediaTag
from sqlalchemy import func as sqlfunc
from gallery.extensions import db


def getMediaInfo(pathFilter: str = None, tagsFilter: list = None):
    rows = db.session.query(
        Media.hash,
        MediaPath.path,
        Media.aspectratio,
        Media.video,
        Media.duration,
        Media.rotation,
        Media.width,
        Media.height,
        Media.size
    ).join(MediaPath.media)

    if pathFilter is not None:
        rows = rows.filter(
            MediaPath.path.like(pathFilter)
        )

    if tagsFilter is not None and len(tagsFilter) > 0:
        rows = (
            rows
            .join(MediaTag, Media.hash == MediaTag.hash)
            # Match ANY tag
            .filter(MediaTag.tag.in_(tagsFilter))
            # Match ALL tags
            .group_by(MediaTag.hash)
            .having(
                sqlfunc.count(
                    sqlfunc.distinct(MediaTag.tag)
                ) == len(tagsFilter)
            )
        )

    return rows.order_by(Media.datetime).all()
