import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props) {
  const _values = Array.isArray(value)
    ? value
    : value !== undefined
      ? [value]
      : Array.isArray(defaultValue)
        ? defaultValue
        : defaultValue !== undefined
          ? [defaultValue]
          : [min, max]

  return (
    <SliderPrimitive.Root
      className={cn("data-horizontal:w-full data-vertical:h-full outline-none focus:outline-none flex items-center relative py-4 isolate", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col group">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow overflow-hidden rounded-full bg-zinc-200 select-none data-horizontal:h-2 data-horizontal:w-full data-vertical:h-full data-vertical:w-2 border border-zinc-300"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-black select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className="relative block size-5 shrink-0 rounded-full border-[3px] border-black bg-[#FFE867] transition-[transform,box-shadow] select-none hover:scale-110 focus-visible:outline-none focus:outline-none focus:ring-0 active:scale-95 disabled:opacity-50 cursor-grab active:cursor-grabbing shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] z-10"
          >
             <div className="absolute inset-[-15px]" />
          </SliderPrimitive.Thumb>
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
