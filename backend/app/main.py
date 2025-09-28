from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from sqlalchemy import text
from dotenv import load_dotenv
from .db import Base, engine
from .routers_auth import router as auth_router
from .routers_cv import router as cv_router
from .routers_match import router as match_router, router_matching
from .routers_debug import router as debug_router
from .routers_utils import router as utils_router
from .routers_llm import router as llm_router
from .routers_evaluation import router as evaluation_router


def create_app() -> FastAPI:
    load_dotenv()
    Base.metadata.create_all(bind=engine)

    # Startup migration: ensure new columns exist without manual scripts
    try:
        with engine.connect() as conn:
            # Ensure enum 'llmprovider' contains value 'ollama'
            try:
                exists = conn.execute(
                    text(
                        """
                        SELECT 1 FROM pg_type t
                        JOIN pg_enum e ON t.oid = e.enumtypid
                        WHERE t.typname = 'llmprovider' AND e.enumlabel = 'ollama'
                        """
                    )
                ).first()
                if not exists:
                    # Add enum value if missing
                    conn.execute(text("ALTER TYPE llmprovider ADD VALUE 'ollama'"))
            except Exception:
                pass

            conn.execute(
                text(
                    """
                    ALTER TABLE llm_configs
                    ADD COLUMN IF NOT EXISTS ollama_base_url VARCHAR(512)
                    """
                )
            )
            conn.commit()
    except Exception:
        # Do not block app startup on migration errors
        pass

    app = FastAPI(title="CV Match API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router)
    app.include_router(cv_router)
    app.include_router(match_router)
    app.include_router(router_matching)
    app.include_router(debug_router)
    app.include_router(utils_router)
    app.include_router(llm_router)
    app.include_router(evaluation_router)

    @app.get("/healthz")
    def healthz():
        return {"status": "ok"}

    return app


app = create_app()

