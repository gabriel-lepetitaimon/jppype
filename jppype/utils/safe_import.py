_cv2 = None


def import_cv2():
    global _cv2
    error = ImportError(  # noqa: B904
        "cv2 is not available in the current python environment.\n"
        "\t This package is required by jppype but "
        "we can't add it to the dependencies to prevent versions conflict.\n"
        "\t Please install it by yourself using `pip install opencv-python-headless`."
    )
    if _cv2 is not None:
        if isinstance(_cv2, ImportError):
            raise _cv2
        else:
            return _cv2

    try:
        import cv2
    except ImportError:
        _cv2 = error
        raise error from None
    else:
        _cv2 = cv2

    return cv2
