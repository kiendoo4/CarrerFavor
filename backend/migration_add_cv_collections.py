#!/usr/bin/env python3
"""
Migration script to add CV Collections functionality
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from app.config import settings
from app.db import Base
from app.models import CVCollection

def run_migration():
    """Run the migration to add CV collections"""
    engine = create_engine(settings.database_url)
    
    with engine.connect() as conn:
        # Create cv_collections table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS cv_collections (
                id SERIAL PRIMARY KEY,
                owner_id INTEGER NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            )
        """))
        
        # Add collection_id column to cvs table if it doesn't exist
        conn.execute(text("""
            DO $$ 
            BEGIN 
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='cvs' AND column_name='collection_id'
                ) THEN 
                    ALTER TABLE cvs ADD COLUMN collection_id INTEGER;
                END IF;
            END $$;
        """))
        
        # Add foreign key constraint
        conn.execute(text("""
            DO $$ 
            BEGIN 
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints 
                    WHERE constraint_name='fk_cv_collection'
                ) THEN 
                    ALTER TABLE cvs 
                    ADD CONSTRAINT fk_cv_collection 
                    FOREIGN KEY (collection_id) REFERENCES cv_collections(id);
                END IF;
            END $$;
        """))
        
        # Add index on collection_id
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_cv_collection_id ON cvs(collection_id);
        """))
        
        conn.commit()
        print("Migration completed successfully!")

if __name__ == "__main__":
    run_migration() 