from models.models import Media, MediaPath, MediaTag
from sqlalchemy import func as sqlfunc, or_, select
from models import db


def getMediaInfo(
    pathFilter: str = None,
    tagsFilter: list = None,
    itagsFilter: list = None,
    typeFilter: list = None
):
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

    if typeFilter is not None and len(typeFilter) > 0:
        conditions = []

        if "video" in typeFilter and "image" not in typeFilter:
            conditions.append(Media.video.is_(True))
        elif "video" not in typeFilter and "image" in typeFilter:
            conditions.append(Media.video.is_(False))

        # Filter extensions / mimetypes
        mediaExts = [t for t in typeFilter if t not in ("video", "image")]
        if mediaExts:
            ext_conditions = [
                MediaPath.path.like(f"%.{ext}") for ext in mediaExts
            ]
            conditions.append(or_(*ext_conditions))

        if conditions:
            rows = rows.filter(or_(*conditions))

    if tagsFilter is not None and len(tagsFilter) > 0:
        rows = (
            rows
            .join(MediaTag, Media.hash == MediaTag.hash)
            # Match ANY tag in filter
            .filter(MediaTag.tag.in_(tagsFilter))
            # Match ALL tags in filter
            .group_by(MediaTag.hash)
            # Count number of tag matches for hash
            .having(
                sqlfunc.count(
                    sqlfunc.distinct(MediaTag.tag)
                ) == len(tagsFilter)
            )
        )

    # Exclude media with any tags in itagsFilter
    if itagsFilter is not None and len(itagsFilter) > 0:
        rows = rows.filter(
            ~Media.hash.in_(
                select(
                    rows.session.query(MediaTag.hash)
                    .filter(MediaTag.tag.in_(itagsFilter))
                    .subquery()
                )
            )
        )

    return rows.order_by(MediaPath.path).all()
