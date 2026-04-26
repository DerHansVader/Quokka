from __future__ import annotations
import base64
import io
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class Image:
    """Wraps a PIL image or raw bytes for logging."""
    data: Any  # PIL.Image or bytes
    caption: Optional[str] = None

    def to_bytes(self) -> bytes:
        if isinstance(self.data, bytes):
            return self.data
        buf = io.BytesIO()
        self.data.save(buf, format="PNG")
        return buf.getvalue()

    def to_base64(self) -> str:
        return base64.b64encode(self.to_bytes()).decode()


@dataclass
class Sample:
    """Ground-truth vs prediction comparison at a step."""
    gt: Optional[str] = None
    pred: Optional[str] = None
    image: Optional[Image] = None

    def __post_init__(self):
        if self.image is not None and not isinstance(self.image, Image):
            self.image = Image(data=self.image)


@dataclass
class Table:
    """Simple table logging."""
    columns: list[str] = field(default_factory=list)
    data: list[list[Any]] = field(default_factory=list)
