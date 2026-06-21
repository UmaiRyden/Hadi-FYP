import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./traffic_classifier.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations():
    """
    Lightweight, idempotent schema migrations.

    Base.metadata.create_all() creates missing tables but never alters existing
    ones, so columns added after a table already exists must be applied by hand.
    This inspects each table and ADDs any missing columns. Works on both SQLite
    (dev) and PostgreSQL (prod) — plain `ALTER TABLE ... ADD COLUMN` is supported
    by both. Safe to run on every startup.
    """
    # table -> {column_name: column_type_ddl}
    additions = {
        "analysis_results": {
            "vpn_detected": "BOOLEAN",
            "flows_json": "TEXT",
            "devices_json": "TEXT",
        },
        "analysis_jobs": {
            "total_flows": "INTEGER",
            "processed_flows": "INTEGER",
            "partial_predictions_json": "TEXT",
        },
    }

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    is_postgres = engine.dialect.name == "postgresql"

    # ── New tables ──────────────────────────────────────────────────────────────
    # Created idempotently with CREATE TABLE IF NOT EXISTS. Base.metadata.create_all
    # also builds these from the ORM models, so this is normally a no-op — but it
    # keeps the schema self-describing and works standalone on SQLite (dev) and
    # PostgreSQL (prod). Only the auto-increment PK syntax differs between dialects.
    pk = "SERIAL PRIMARY KEY" if is_postgres else "INTEGER PRIMARY KEY AUTOINCREMENT"
    new_tables = {
        "analysis_history": f"""
            CREATE TABLE IF NOT EXISTS analysis_history (
                id {pk},
                user_id INTEGER NOT NULL REFERENCES users(id),
                original_filename VARCHAR NOT NULL,
                predicted_app VARCHAR NOT NULL,
                confidence FLOAT NOT NULL,
                match_strength VARCHAR NOT NULL,
                flow_count INTEGER NOT NULL,
                packet_count INTEGER NOT NULL,
                vpn_detected BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP
            )
        """,
    }

    with engine.begin() as conn:
        # Create any missing tables first.
        for table, ddl in new_tables.items():
            if table not in existing_tables:
                conn.execute(text(ddl))

        # Then ADD any missing columns on pre-existing tables.
        for table, columns in additions.items():
            if table not in existing_tables:
                continue  # create_all will build it with all columns
            existing_cols = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl_type in columns.items():
                if name not in existing_cols:
                    conn.execute(
                        text(f'ALTER TABLE {table} ADD COLUMN {name} {ddl_type}')
                    )
