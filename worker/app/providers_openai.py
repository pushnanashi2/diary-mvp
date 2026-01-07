"""OpenAI provider functions for STT and other services."""
from typing import Optional
import openai
from .config import get_openai_api_key


def stt_openai(audio_file_path: str) -> Optional[str]:
    """Speech-to-text using OpenAI Whisper.
    
    Args:
        audio_file_path: Path to the audio file
        
    Returns:
        Transcribed text or None if failed
    """
    try:
        openai.api_key = get_openai_api_key()
        
        with open(audio_file_path, 'rb') as audio_file:
            response = openai.Audio.transcribe(
                model="whisper-1",
                file=audio_file
            )
            return response.get('text', '')
    except Exception as e:
        print(f"OpenAI STT error: {e}")
        return None


def chat_completion(messages: list, model: str = "gpt-3.5-turbo", **kwargs) -> Optional[str]:
    """OpenAI chat completion.
    
    Args:
        messages: List of message dictionaries
        model: Model name to use
        **kwargs: Additional parameters
        
    Returns:
        Response text or None if failed
    """
    try:
        openai.api_key = get_openai_api_key()
        
        response = openai.ChatCompletion.create(
            model=model,
            messages=messages,
            **kwargs
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"OpenAI chat completion error: {e}")
        return None
