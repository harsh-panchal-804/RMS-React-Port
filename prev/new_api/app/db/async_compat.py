from __future__ import annotations

import inspect
from functools import wraps
from typing import Any, Callable

from sqlalchemy.ext.asyncio import AsyncSession


def run_with_sync_session(db_param: str = "db") -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """
    Compatibility decorator for legacy sync route handlers while using AsyncSession.
    It runs the sync handler inside AsyncSession.run_sync and swaps the db arg
    with a synchronous Session bound to the same connection context.
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            db = kwargs.get(db_param)
            if not isinstance(db, AsyncSession):
                return func(*args, **kwargs)

            def _invoke(sync_session):
                local_kwargs = dict(kwargs)
                local_kwargs[db_param] = sync_session
                return func(*args, **local_kwargs)

            return await db.run_sync(_invoke)

        wrapper.__signature__ = inspect.signature(func)
        return wrapper

    return decorator
