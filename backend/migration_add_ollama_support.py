#!/usr/bin/env python3
"""
Migration script to add Ollama support to the database.
This script adds the ollama_base_url column to the llm_configs table.
"""

import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the app directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.config import get_database_url
from app.db import Base

def run_migration():
    """Run the migration to add Ollama support."""
    try:
        # Create database engine
        database_url = get_database_url()
        engine = create_engine(database_url)
        
        # Create session
        Session = sessionmaker(bind=engine)
        session = Session()
        
        print("Starting migration to add Ollama support...")
        
        # Check if the column already exists
        result = session.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'llm_configs' 
            AND column_name = 'ollama_base_url'
        """))
        
        if result.fetchone():
            print("ollama_base_url column already exists. Migration not needed.")
            return
        
        # Add the ollama_base_url column
        session.execute(text("""
            ALTER TABLE llm_configs 
            ADD COLUMN ollama_base_url VARCHAR(512)
        """))
        
        session.commit()
        print("Successfully added ollama_base_url column to llm_configs table.")
        
        # Verify the column was added
        result = session.execute(text("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'llm_configs' 
            AND column_name = 'ollama_base_url'
        """))
        
        row = result.fetchone()
        if row:
            print(f"Verification successful: {row[0]} ({row[1]}, nullable: {row[2]})")
        else:
            print("Warning: Could not verify column was added.")
            
    except Exception as e:
        print(f"Migration failed: {e}")
        session.rollback()
        raise
    finally:
        session.close()

if __name__ == "__main__":
    run_migration()
