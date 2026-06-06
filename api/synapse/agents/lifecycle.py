"""Shared Continuum runtime — SynapseApp singleton."""
from __future__ import annotations
import os, sys
from typing import Any

_CONTINUUM_SRC = os.path.join(os.path.dirname(__file__), "..", "..", "..", "continuum", "src")
if os.path.isdir(_CONTINUUM_SRC) and _CONTINUUM_SRC not in sys.path:
    sys.path.insert(0, _CONTINUUM_SRC)

from orchestrator import (
    AgentConfig, AgentMemoryConfig, AgentMemoryScope,
    AgentRunner, BaseAgent, MCPServerStreamableHttp,
    RunnerConfig, ToolExecutor, get_logger,
)
from orchestrator.core.container import Container, get_container
from orchestrator.core.lifecycle import OrchestratorLifecycle, get_lifecycle_manager
from orchestrator.tools.tool_attention.config import ToolAttentionConfig

logger = get_logger(__name__)
KB_MCP_URL = os.environ.get("KB_MCP_URL", "http://localhost:8888/mcp")


class SynapseApp:
    def __init__(self):
        self._lifecycle: OrchestratorLifecycle | None = None
        self._container: Container | None = None
        self._mcp_server: MCPServerStreamableHttp | None = None
        self._tool_executor: ToolExecutor | None = None
        self._runner: AgentRunner | None = None
        self._tools: list[Any] = []
        self._initialized = False

    async def initialize(self):
        if self._initialized:
            return
            
        # Connect Prisma DB
        from synapse.db.client import get_client
        try:
            await get_client().connect()
            logger.info("Prisma DB connected successfully.")
        except Exception as e:
            logger.error(f"Failed to connect Prisma DB: {e}")
            
        self._lifecycle = get_lifecycle_manager(fail_on_unhealthy=False, verify_connections=False, enable_signal_handlers=False)
        await self._lifecycle.initialize()
        self._container = get_container()

        enable_mcp = os.environ.get("SYNAPSE_ENABLE_MCP", "1").strip().lower() not in {
            "0", "false", "off", "no"
        }

        if enable_mcp:
            self._mcp_server = MCPServerStreamableHttp(params={"url": KB_MCP_URL}, client_session_timeout_seconds=60)
            try:
                await self._mcp_server.connect()
                self._tool_executor = ToolExecutor({self._mcp_server: None})
                await self._tool_executor.initialize()
                self._tools = self._tool_executor.get_tool_definitions()
            except Exception as exc:
                logger.error("MCP server unavailable at %s; continuing without KB tools: %s", KB_MCP_URL, exc)
                self._mcp_server = None

        if not enable_mcp or self._mcp_server is None:
            self._tool_executor = ToolExecutor({})
            await self._tool_executor.initialize()
            self._tools = []

        self._runner = AgentRunner(
            container=self._container,
            tool_executor=self._tool_executor,
            config=RunnerConfig(persist_state=False, default_max_turns=20),
        )
        self._initialized = True
        logger.info("SynapseApp ready — %d KB tools", len(self._tools))

    def make_agent(self, *, name, instructions, gateway_mode="quality", output_schema=None,
                   max_turns=15, memory=True, memory_scope=AgentMemoryScope.USER, tool_attention_k=3) -> BaseAgent:
        mc = self._container.memory_client if self._container else None
        mem_ok = memory and mc is not None and mc.is_enabled
        return BaseAgent(
            name=name, instructions=instructions, model="auto", gateway_mode=gateway_mode,
            tools=self._tools, tool_executor=self._tool_executor, output_schema=output_schema,
            memory_config=AgentMemoryConfig(
                search_memories=mem_ok, store_memories=mem_ok,
                search_scope=memory_scope, store_scope=memory_scope, search_limit=8,
                extraction_prompt="Extract long-term educational facts about the student: knowledge gaps, strengths, learning preferences. Do not store transient quiz answers.",
            ),
            config=AgentConfig(max_turns=max_turns, log_to_session=True,
                               tool_attention=ToolAttentionConfig(k=tool_attention_k, min_tools=3)),
        )

    @property
    def runner(self) -> AgentRunner:
        assert self._runner, "Not initialized"; return self._runner
    @property
    def container(self) -> Container:
        assert self._container, "Not initialized"; return self._container
    @property
    def tools(self): return self._tools
    @property
    def mcp_server(self): return self._mcp_server

    async def close(self):
        if self._mcp_server:
            try: await self._mcp_server.cleanup()
            except Exception: pass
        if self._lifecycle:
            await self._lifecycle.shutdown()
            
        from synapse.db.client import get_client
        try:
            await get_client().disconnect()
        except Exception: pass
            
        self._initialized = False


_app: SynapseApp | None = None

def get_synapse_app() -> SynapseApp:
    global _app
    if _app is None:
        _app = SynapseApp()
    return _app

async def close_synapse_app():
    global _app
    if _app:
        await _app.close()
        _app = None
