export const LUA_DOCS = `# Aseprite Lua API cheat sheet (run with: aseprite --batch --script file.lua)

## Globals
app.sprite            -- active sprite (nil in batch unless you open/create one)
app.activeLayer / app.activeFrame / app.activeCel
app.params            -- script params (--script-param key=value)
print(...)            -- goes to stdout
Rect(x,y,w,h)  Point(x,y)  Size(w,h)
Color{ r=255, g=0, b=0, a=255 }  or  Color(255,0,0,255)  or Color{ gray=128 }
app.pixelColor.rgba(r,g,b,a)  -- integer pixel value (RGB mode)

## Sprite
local spr = Sprite(width, height)            -- new RGB sprite (also: Sprite(w,h,ColorMode.INDEXED))
local spr = Sprite{ fromFile="in.png" }      -- open file
spr.width / spr.height / spr.colorMode / spr.filename
spr.layers  spr.frames  spr.cels  spr.palettes  spr.tags
spr:newFrame()  spr:newEmptyFrame()  spr:deleteFrame(frame)
spr:newLayer()  spr:deleteLayer(layer)
spr:resize(w,h)  spr:crop(x,y,w,h)  spr:flatten()
spr:setPalette(palette)
spr:saveAs("out.aseprite")   -- changes sprite filename
spr:saveCopyAs("out.png")    -- export without changing filename (png/gif/aseprite/...). Multi-frame -> out{frame}.png unless gif/sheet
spr.frames[1].duration = 0.1 -- seconds
local tag = spr:newTag(fromFrame, toFrame); tag.name="walk"; tag.aniDir=AniDir.FORWARD

## Layer
local layer = spr.layers[1]
layer.name = "bg"; layer.isVisible = true; layer.opacity = 255; layer.blendMode = BlendMode.NORMAL
layer.isGroup / layer.isImage / layer.cels
layer = spr:newLayer()

## Cel
local cel = spr:newCel(layer, frame, image, Point(x,y))   -- or spr:newCel(layer, 1)
cel.image   cel.position (Point)   cel.frame   cel.layer   cel.opacity

## Image (pixel buffer, coordinates 0-based inside the image)
local img = Image(w, h)                      -- RGB by default; Image(w,h,ColorMode.RGB)
local img = cel.image
img:putPixel(x, y, color)                    -- color: Color or integer from pixelColor
img:getPixel(x, y)                           -- integer
img:clear()   img:clear(Rect)   img:clone()
img:drawImage(otherImage, Point(x,y))
img:drawSprite(spr, frameNumber, Point(x,y))
for it in img:pixels() do it(app.pixelColor.rgba(255,0,0,255)) end  -- it.x, it.y, it() getter, it(v) setter
-- fastest way to fill: loop over x,y with putPixel; modifying img directly is fine for a fresh cel

## Palette
local pal = spr.palettes[1]
#pal                               -- number of colors
pal:resize(n)
pal:setColor(index, Color{r=..,g=..,b=..})   -- index is 0-based
pal:getColor(index)

## GraphicsContext-free drawing helpers (via Image only)
No native line/circle/rect primitives on Image: write small helpers (loops + putPixel) in the script.

## Common patterns
-- Create, draw, export
local spr = Sprite(32, 32)
local cel = spr.cels[1]
local img = cel.image
local red = Color{r=255,g=0,b=0}
for y=0,31 do for x=0,31 do
  if (x-16)^2 + (y-16)^2 <= 100 then img:putPixel(x,y,red) end
end end
spr:saveCopyAs("circle.png")

-- Animation: draw into each frame's cel
for i=1,4 do
  if i>1 then spr:newFrame() end
  local c = spr.cels[i]   -- cel of frame i on layer 1
  ...
end
spr:saveCopyAs("anim.gif")

-- Scale up for preview
spr:resize(spr.width*8, spr.height*8)  -- use only on a copy; nearest-neighbor for pixel art

## Notes
- Paths are relative to the server's working directory unless absolute; prefer absolute output paths.
- Batch mode has no UI: do not use Dialog or app.command that needs a window.
- Image coordinates are 0-based; Lua arrays (layers, frames, cels) are 1-based; palette indices are 0-based.
- Errors surface on stderr with a line number; fix and re-run.
`;
