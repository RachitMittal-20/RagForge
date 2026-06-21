from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    GROQ_API_KEY: str
    CHROMA_PERSIST_DIR: str = "./chroma_db"

    class Config:
        env_file = ".env"


settings = Settings()
