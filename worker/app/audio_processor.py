"""
Phase 4.3: 音声品質向上処理
FFmpeg + pydub を使用したノイズ除去・正規化・エンハンス
"""

from pydub import AudioSegment
from pydub.effects import normalize, compress_dynamic_range
import io

def denoise_audio(audio_bytes: bytes) -> bytes:
    """
    ノイズ除去（高周波ノイズリダクション）
    
    Args:
        audio_bytes: 元の音声データ
    
    Returns:
        ノイズ除去後の音声データ
    """
    audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
    audio = audio.high_pass_filter(100)
    audio = audio.low_pass_filter(8000)
    
    output = io.BytesIO()
    audio.export(output, format='mp3', bitrate='128k')
    return output.getvalue()

def normalize_audio(audio_bytes: bytes) -> bytes:
    """
    音量正規化（最大音量を0dBに調整）
    """
    audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
    normalized = normalize(audio)
    
    output = io.BytesIO()
    normalized.export(output, format='mp3', bitrate='128k')
    return output.getvalue()

def enhance_audio(audio_bytes: bytes) -> bytes:
    """
    音声エンハンス（ノイズ除去 + 正規化 + ダイナミックレンジ圧縮）
    """
    audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
    
    # ノイズ除去
    audio = audio.high_pass_filter(100)
    audio = audio.low_pass_filter(8000)
    
    # ダイナミックレンジ圧縮
    audio = compress_dynamic_range(audio, threshold=-20.0, ratio=4.0)
    
    # 正規化
    audio = normalize(audio)
    
    # ゲイン追加
    audio = audio + 2  # +2dB
    
    output = io.BytesIO()
    audio.export(output, format='mp3', bitrate='192k')
    return output.getvalue()

def get_audio_info(audio_bytes: bytes) -> dict:
    """音声ファイルの情報を取得"""
    audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
    
    return {
        'duration_ms': len(audio),
        'duration_seconds': len(audio) / 1000.0,
        'channels': audio.channels,
        'frame_rate': audio.frame_rate,
        'sample_width': audio.sample_width,
        'dBFS': audio.dBFS,
        'max_dBFS': audio.max_dBFS
    }
