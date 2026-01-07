"""Action item extractor for diary entries."""
from typing import List, Dict, Any
import openai
from .config import get_openai_api_key


class ActionExtractor:
    """Extract action items from diary entries using OpenAI."""

    def __init__(self):
        """Initialize the action extractor."""
        openai.api_key = get_openai_api_key()

    def extract_actions(self, text: str) -> List[Dict[str, Any]]:
        """Extract action items from text.
        
        Args:
            text: The diary entry text to analyze
            
        Returns:
            List of action items with description, priority, and deadline
        """
        if not text or not text.strip():
            return []

        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": "Extract action items from the text. Return JSON array with: description, priority (high/medium/low), deadline (if mentioned)."
                    },
                    {"role": "user", "content": text}
                ],
                temperature=0.3,
                max_tokens=500
            )
            
            # Parse response
            content = response.choices[0].message.content
            # Basic parsing - in real implementation, use proper JSON parsing
            return self._parse_actions(content)
            
        except Exception as e:
            print(f"Error extracting actions: {e}")
            return []

    def _parse_actions(self, content: str) -> List[Dict[str, Any]]:
        """Parse OpenAI response into action items.
        
        Args:
            content: The response content from OpenAI
            
        Returns:
            List of parsed action items
        """
        # Simplified parsing - real implementation would be more robust
        try:
            import json
            return json.loads(content)
        except:
            return []
