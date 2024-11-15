<script>
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import { onMount } from "svelte";
  import { shapes } from "$lib/stores/shapes.js";
  import { debounce } from "$lib/utils/debounce.js";
  import { createConfetti } from "$lib/utils/confetti.js";
  import { Moon, Sun } from "lucide-svelte";

  const STATUS_COLORS = {
    pending: "#64748b",
    done: "#22c55e"
  };

  const GRID_SIZE = 20;
  const GRID_COLOR = "#ccc";
  const DOT_SIZE = 2;
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 5;

  let canvas;
  let ctx;
  let selectedShape = null;
  let isDrawing = false;
  let isDragging = false;
  let isResizing = false;
  let isPanning = false;
  let isAddingMode = false;
  let startX = 0;
  let startY = 0;
  let isEditingText = false;
  let textInputX = 0;
  let textInputY = 0;
  let resizeHandle = null;
  let currentCursor = "grab";
  let fileInput;
  let lastMouseDownTime = 0;
  let mouseDownPos = { x: 0, y: 0 };
  let viewportOffset = { x: 0, y: 0 };
  let lastPanPosition = { x: 0, y: 0 };
  let zoom = 1;
  let isDarkMode = true;
  const DOUBLE_CLICK_THRESHOLD = 300;
  const DRAG_THRESHOLD = 5;

  onMount(() => {
    ctx = canvas.getContext("2d");
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("keydown", handleKeyDown);
    canvas.addEventListener("wheel", handleWheel, { passive: false });

    // Check system preference for dark mode
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      toggleDarkMode();
    }

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("keydown", handleKeyDown);
      canvas.removeEventListener("wheel", handleWheel);
    };
  });

  $: if ($shapes) {
    drawShapes();
  }

  function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.documentElement.classList.toggle('dark');
    drawShapes();
  }

  function handleWheel(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = mouseX / zoom + viewportOffset.x;
    const worldY = mouseY / zoom + viewportOffset.y;

    const zoomDelta = -e.deltaY * 0.001;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * (1 + zoomDelta)));
    const zoomFactor = newZoom / zoom;
    zoom = newZoom;

    viewportOffset.x = worldX - mouseX / zoom;
    viewportOffset.y = worldY - mouseY / zoom;

    drawShapes();
  }

  function handleKeyDown(e) {
    if (!isEditingText && selectedShape && (e.key === "Delete" || e.key === "Backspace")) {
      shapes.update(s => s.filter(shape => shape !== selectedShape));
      selectedShape = null;
      drawShapes();
    }
  }

  function drawGrid() {
    const gridSize = GRID_SIZE * zoom;
    const startX = Math.floor(viewportOffset.x / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(viewportOffset.y / GRID_SIZE) * GRID_SIZE;
    const endX = startX + (canvas.width / zoom) + GRID_SIZE;
    const endY = startY + (canvas.height / zoom) + GRID_SIZE;

    ctx.fillStyle = !isDarkMode ? "#374151" : GRID_COLOR;
    for (let x = startX; x < endX; x += GRID_SIZE) {
      for (let y = startY; y < endY; y += GRID_SIZE) {
        const screenX = (x - viewportOffset.x) * zoom;
        const screenY = (y - viewportOffset.y) * zoom;
        ctx.beginPath();
        ctx.arc(screenX, screenY, DOT_SIZE / 2 * zoom, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function triggerConfetti(x, y) {
    createConfetti({
      x: x / window.innerWidth,
      y: y / window.innerHeight,
      count: 50,
      spread: 60
    });
  }

  function exportCanvas() {
    const dataStr = JSON.stringify($shapes);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'tasks-data.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  function importCanvas(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const importedShapes = JSON.parse(e.target.result);
          shapes.set(importedShapes);
          selectedShape = null;
          drawShapes();
        } catch (error) {
          console.error('Error importing file:', error);
        }
      };
      reader.readAsText(file);
    }
  }

  function getContrastColor(hexcolor) {
    const hex = hexcolor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#ffffff";
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawShapes();
  }

  function drawShapes() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.scale(zoom, zoom);
    
    drawGrid();

    $shapes.forEach(shape => {
      ctx.beginPath();
      ctx.fillStyle = STATUS_COLORS[shape.status];
      const screenX = shape.x - viewportOffset.x;
      const screenY = shape.y - viewportOffset.y;

      ctx.roundRect(screenX, screenY, shape.width, shape.height, 8);
      ctx.fill();

      if (shape.text && (!isEditingText || shape !== selectedShape)) {
        ctx.fillStyle = getContrastColor(STATUS_COLORS[shape.status]);
        ctx.font = `${14/zoom}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const centerX = screenX + shape.width / 2;
        const centerY = screenY + shape.height / 2;
        ctx.fillText(shape.text, centerX, centerY);
      }

      if (shape === selectedShape) {
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();

        const handles = getResizeHandles(shape);
        handles.forEach(handle => {
          ctx.beginPath();
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = "#2563eb";
          const handleX = handle.x - viewportOffset.x;
          const handleY = handle.y - viewportOffset.y;
          ctx.rect(handleX - 4/zoom, handleY - 4/zoom, 8/zoom, 8/zoom);
          ctx.fill();
          ctx.stroke();
        });
      }
    });

    ctx.restore();
  }

  function getResizeHandles(shape) {
    const { x, y, width, height } = shape;
    return [
      { x, y, cursor: 'nw-resize', position: 'nw' },
      { x: x + width, y, cursor: 'ne-resize', position: 'ne' },
      { x, y: y + height, cursor: 'sw-resize', position: 'sw' },
      { x: x + width, y: y + height, cursor: 'se-resize', position: 'se' }
    ];
  }

  function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    startX = mouseX;
    startY = mouseY;
    mouseDownPos = { x: mouseX, y: mouseY };
    lastPanPosition = { x: mouseX, y: mouseY };

    const currentTime = Date.now();
    const isDoubleClick = currentTime - lastMouseDownTime < DOUBLE_CLICK_THRESHOLD;
    lastMouseDownTime = currentTime;

    const worldX = mouseX / zoom + viewportOffset.x;
    const worldY = mouseY / zoom + viewportOffset.y;

    if (selectedShape) {
      const handles = getResizeHandles(selectedShape);
      const handle = handles.find(h => {
        const screenX = (h.x - viewportOffset.x) * zoom;
        const screenY = (h.y - viewportOffset.y) * zoom;
        return Math.abs(screenX - mouseX) < 8 && Math.abs(screenY - mouseY) < 8;
      });

      if (handle) {
        isResizing = true;
        resizeHandle = handle.position;
        return;
      }
    }

    const clickedShape = $shapes.find(shape => 
      isPointInShape(worldX, worldY, shape)
    );

    if (clickedShape) {
      selectedShape = clickedShape;
      if (isDoubleClick) {
        const centerX = (clickedShape.x - viewportOffset.x) * zoom + clickedShape.width * zoom / 2;
        const centerY = (clickedShape.y - viewportOffset.y) * zoom + clickedShape.height * zoom / 2;
        textInputX = centerX;
        textInputY = centerY;
        isEditingText = true;
        setTimeout(() => {
          const input = document.getElementById('textInput');
          if (input) {
            input.focus();
          }
        }, 0);
      } else {
        isDragging = true;
      }
    } else if (isAddingMode && e.button === 0) {
      selectedShape = {
        type: "rectangle",
        x: worldX,
        y: worldY,
        width: 0,
        height: 0,
        status: "pending",
        text: ""
      };
      isDrawing = true;
      shapes.update(s => [...s, selectedShape]);
    } else {
      selectedShape = null;
      isPanning = true;
      currentCursor = "grabbing";
    }
    drawShapes();
  }

  function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldX = mouseX / zoom + viewportOffset.x;
    const worldY = mouseY / zoom + viewportOffset.y;

    if (isPanning) {
      const dx = mouseX - lastPanPosition.x;
      const dy = mouseY - lastPanPosition.y;
      viewportOffset.x -= dx / zoom;
      viewportOffset.y -= dy / zoom;
      lastPanPosition = { x: mouseX, y: mouseY };
      drawShapes();
      return;
    }

    if (selectedShape && !isDrawing && !isDragging && !isResizing) {
      const handles = getResizeHandles(selectedShape);
      const handle = handles.find(h => {
        const screenX = (h.x - viewportOffset.x) * zoom;
        const screenY = (h.y - viewportOffset.y) * zoom;
        return Math.abs(screenX - mouseX) < 8 && Math.abs(screenY - mouseY) < 8;
      });
      
      if (handle) {
        currentCursor = handle.cursor;
      } else if (isPointInShape(worldX, worldY, selectedShape)) {
        currentCursor = "pointer";
      } else {
        currentCursor = isAddingMode ? "crosshair" : "grab";
      }
    } else {
      currentCursor = isPanning ? "grabbing" : (isAddingMode ? "crosshair" : "grab");
    }

    if (isResizing && selectedShape) {
      const dx = (mouseX - startX) / zoom;
      const dy = (mouseY - startY) / zoom;

      switch (resizeHandle) {
        case 'se':
          selectedShape.width = Math.max(20, selectedShape.width + dx);
          selectedShape.height = Math.max(20, selectedShape.height + dy);
          break;
        case 'sw':
          selectedShape.width = Math.max(20, selectedShape.width - dx);
          selectedShape.x += dx;
          selectedShape.height = Math.max(20, selectedShape.height + dy);
          break;
        case 'ne':
          selectedShape.width = Math.max(20, selectedShape.width + dx);
          selectedShape.height = Math.max(20, selectedShape.height - dy);
          selectedShape.y += dy;
          break;
        case 'nw':
          selectedShape.width = Math.max(20, selectedShape.width - dx);
          selectedShape.height = Math.max(20, selectedShape.height - dy);
          selectedShape.x += dx;
          selectedShape.y += dy;
          break;
      }
      startX = mouseX;
      startY = mouseY;
      shapes.update(s => [...s]);
    } else if (isDragging && selectedShape) {
      const dx = (mouseX - startX) / zoom;
      const dy = (mouseY - startY) / zoom;
      selectedShape.x += dx;
      selectedShape.y += dy;
      startX = mouseX;
      startY = mouseY;
      shapes.update(s => [...s]);
    } else if (isDrawing && selectedShape) {
      selectedShape.width = Math.abs(worldX - selectedShape.x);
      selectedShape.height = Math.abs(worldY - selectedShape.y);
      if (worldX < selectedShape.x) selectedShape.x = worldX;
      if (worldY < selectedShape.y) selectedShape.y = worldY;
      shapes.update(s => [...s]);
    }

    if (isDrawing || isDragging || isResizing) {
      drawShapes();
    }
  }

  function handleMouseUp(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldX = mouseX / zoom + viewportOffset.x;
    const worldY = mouseY / zoom + viewportOffset.y;
    
    const dx = Math.abs(mouseX - mouseDownPos.x);
    const dy = Math.abs(mouseY - mouseDownPos.y);
    const isClick = dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD;

    if (selectedShape && isClick && !isDrawing && !isResizing && !isPanning) {
      const wasNotDone = selectedShape.status === "pending";
      selectedShape.status = selectedShape.status === "pending" ? "done" : "pending";
      shapes.update(s => [...s]);
      if (wasNotDone) {
        triggerConfetti(mouseX, mouseY);
      }
    }

    if (isDrawing && selectedShape) {
      if (selectedShape.width < 20 && selectedShape.height < 20) {
        shapes.update(s => s.filter(shape => shape !== selectedShape));
        selectedShape = null;
      } else {
        const centerX = (selectedShape.x - viewportOffset.x) * zoom + selectedShape.width * zoom / 2;
        const centerY = (selectedShape.y - viewportOffset.y) * zoom + selectedShape.height * zoom / 2;
        textInputX = centerX;
        textInputY = centerY;
        isEditingText = true;
        setTimeout(() => {
          const input = document.getElementById('textInput');
          if (input) {
            input.focus();
          }
        }, 0);
      }
    }

    isDrawing = false;
    isDragging = false;
    isResizing = false;
    isPanning = false;
    currentCursor = isAddingMode ? "crosshair" : "grab";
    resizeHandle = null;
    drawShapes();
  }

  function isPointInShape(x, y, shape) {
    return x >= shape.x && x <= shape.x + shape.width &&
           y >= shape.y && y <= shape.y + shape.height;
  }

  function handleTextInput(e) {
    if (selectedShape) {
      selectedShape.text = e.target.value;
      shapes.update(s => [...s]);
      drawShapes();
    }
  }

  function handleTextBlur() {
    isEditingText = false;
    drawShapes();
  }

  function toggleAddingMode() {
    isAddingMode = !isAddingMode;
    currentCursor = isAddingMode ? "crosshair" : "grab";
  }
</script>

<div class="fixed inset-0 bg-background">
  <div class="absolute top-4 left-4 z-10 flex gap-4">
    <Button 
      variant={isAddingMode ? "default" : "outline"} 
      on:click={toggleAddingMode}
    >
      {isAddingMode ? "Drawing" : "Add"}
    </Button>

    <input
      type="file"
      accept=".json"
      on:change={importCanvas}
      bind:this={fileInput}
      class="hidden"
    />
    <Button variant="outline" on:click={() => fileInput.click()}>Import</Button>
    <Button variant="outline" on:click={exportCanvas}>Export</Button>

    <div class="flex items-center gap-2 ml-4">
      <span class="text-sm text-muted-foreground">Zoom: {Math.round(zoom * 100)}%</span>
    </div>

    <Button variant="outline" size="icon" on:click={toggleDarkMode} class="ml-auto">
      {#if isDarkMode}
        <Sun class="h-4 w-4" />
      {:else}
        <Moon class="h-4 w-4" />
      {/if}
    </Button>
  </div>

  <canvas
    bind:this={canvas}
    on:mousedown={handleMouseDown}
    on:mousemove={handleMouseMove}
    on:mouseup={handleMouseUp}
    class="absolute inset-0 touch-none"
    style="cursor: {currentCursor};"
  />

  {#if isEditingText && selectedShape}
    <input
      type="text"
      id="textInput"
      class="absolute bg-transparent border-none outline-none text-center text-sm pointer-events-auto"
      style="left: {textInputX}px; top: {textInputY}px; transform: translate(-50%, -50%); min-width: 60px; color: {getContrastColor(STATUS_COLORS[selectedShape.status])};"
      value={selectedShape.text || ''}
      placeholder="Add task"
      on:input={handleTextInput}
      on:blur={handleTextBlur}
    />
  {/if}
</div>