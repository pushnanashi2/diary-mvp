"""Speech processing and transcription module."""
from typing import Dict, Any, Optional
import openai
from .config import get_openai_api_key


class SpeechProcessor:
    """Process speech and audio files."""

    def __init__(self):
        """Initialize the speech processor."""
        openai.api_key = get_openai_api_key()

    def transcribe(self, audio_file_path: str) -> Optional[str]:
        """Transcribe audio file to text.
        
        Args:
            audio_file_path: Path to the audio file
            
        Returns:
            Transcribed text or None if failed
        """
        try:
            with open(audio_file_path, 'rb') as audio_file:
                response = openai.Audio.transcribe(
                    model="whisper-1",
                    file=audio_file
                )
                return response.get('text', '')
        except Exception as e:
            print(f"Error transcribing audio: {e}")
            return None

    def analyze_speech_patterns(self, text: str) -> Dict[str, Any]:
        """Analyze speech patterns in transcribed text.
        
        Args:
            text: The transcribed text to analyze
            
        Returns:
            Dictionary with speech pattern analysis
        """
        if not text or not text.strip():
            return {
                'pace': 'unknown',
                'tone': 'neutral',
                'confidence': 0.0
            }

        # Basic analysis - count words, sentences, etc.
        words = text.split()
        sentences = text.split('.')
        
        return {
            'pace': 'normal' if len(words) < 200 else 'fast',
            'tone': 'neutral',
            'word_count': len(words),
            'sentence_count': len(sentences),
            'confidence': 0.8
        }
