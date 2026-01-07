"""
Pipeline基底クラス
各処理ステップを連鎖させるパターン
"""
from abc import ABC, abstractmethod
from typing import Any, Dict


class PipelineStep(ABC):
    """Pipeline内の1ステップを表す抽象クラス"""
    
    @abstractmethod
    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        ステップを実行
        
        Args:
            context: パイプライン共有コンテキスト
        
        Returns:
            更新されたコンテキスト
        """
        pass
    
    def on_error(self, context: Dict[str, Any], error: Exception) -> Dict[str, Any]:
        """
        エラーハンドリング（オプション）
        
        Args:
            context: パイプライン共有コンテキスト
            error: 発生したエラー
        
        Returns:
            エラー情報を含むコンテキスト
        """
        context['error'] = {
            'step': self.__class__.__name__,
            'message': str(error),
            'type': type(error).__name__
        }
        return context


class Pipeline:
    """複数のステップを順次実行するパイプライン"""
    
    def __init__(self, steps: list[PipelineStep]):
        self.steps = steps
    
    def run(self, initial_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        パイプラインを実行
        
        Args:
            initial_context: 初期コンテキスト
        
        Returns:
            最終コンテキスト
        """
        context = initial_context.copy()
        
        for step in self.steps:
            try:
                context = step.execute(context)
                
                # エラーが既に設定されている場合は中断
                if 'error' in context:
                    break
                    
            except Exception as e:
                context = step.on_error(context, e)
                break
        
        return context
