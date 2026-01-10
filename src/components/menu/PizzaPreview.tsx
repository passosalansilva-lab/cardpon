import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PizzaPreviewProps {
  flavors: Array<{
    id: string;
    name: string;
    image_url: string | null;
  }>;
  maxFlavors: number;
}

export function PizzaPreview({ flavors, maxFlavors }: PizzaPreviewProps) {
  const slices = useMemo(() => {
    if (flavors.length === 0) return [];

    const totalSlices = flavors.length;
    const anglePerSlice = 360 / totalSlices;

    return flavors.map((flavor, index) => {
      const startAngle = index * anglePerSlice - 90; // -90 to start from top
      const endAngle = startAngle + anglePerSlice;

      // Convert to radians
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      // Calculate slice path
      const centerX = 150;
      const centerY = 150;
      const radius = 130;

      const x1 = centerX + radius * Math.cos(startRad);
      const y1 = centerY + radius * Math.sin(startRad);
      const x2 = centerX + radius * Math.cos(endRad);
      const y2 = centerY + radius * Math.sin(endRad);

      const largeArcFlag = anglePerSlice > 180 ? 1 : 0;

      const pathData = [
        `M ${centerX} ${centerY}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        "Z",
      ].join(" ");

      // Color palette for slices
      const colors = [
        "hsl(var(--primary))",
        "hsl(var(--secondary))",
        "hsl(var(--accent))",
        "#FF6B6B",
        "#4ECDC4",
        "#FFD93D",
      ];

      return {
        id: flavor.id,
        name: flavor.name,
        pathData,
        color: colors[index % colors.length],
        // Text label position (middle of slice)
        labelAngle: startAngle + anglePerSlice / 2,
        labelX: centerX + (radius * 0.6) * Math.cos(((startAngle + anglePerSlice / 2) * Math.PI) / 180),
        labelY: centerY + (radius * 0.6) * Math.sin(((startAngle + anglePerSlice / 2) * Math.PI) / 180),
      };
    });
  }, [flavors]);

  const hasImage = flavors.some((f) => !!f.image_url);

  if (flavors.length === 0) {
    return (
      <motion.div
        className="relative w-full max-w-[300px] mx-auto aspect-square"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <svg viewBox="0 0 300 300" className="w-full h-full">
          {/* Empty pizza base */}
          <motion.circle
            cx="150"
            cy="150"
            r="130"
            fill="hsl(var(--muted))"
            stroke="hsl(var(--border))"
            strokeWidth="3"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, ease: "backOut" }}
          />
          <circle cx="150" cy="150" r="130" fill="url(#emptyPattern)" opacity="0.3" />
          <defs>
            <pattern
              id="emptyPattern"
              x="0"
              y="0"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="10" cy="10" r="2" fill="hsl(var(--muted-foreground))" />
            </pattern>
          </defs>
          <motion.text
            x="150"
            y="150"
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-sm fill-muted-foreground font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          >
            Selecione os sabores
          </motion.text>
        </svg>
      </motion.div>
    );
  }

  if (hasImage) {
    const firstWithImage = flavors.find((f) => f.image_url) || flavors[0];

    return (
      <motion.div
        className="w-full max-w-[300px] mx-auto space-y-2"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-muted">
          <img
            src={firstWithImage.image_url || ""}
            alt={firstWithImage.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-2 bottom-2 rounded-md bg-background/80 px-2 py-1 text-[11px] shadow-sm">
            <p className="font-semibold">Pizza meio a meio</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {flavors.map((f) => f.name).join(" • ")}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="relative w-full max-w-[300px] mx-auto aspect-square"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <svg viewBox="0 0 300 300" className="w-full h-full">
        <defs>
          {/* Shadow filter */}
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="2" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Crust texture */}
          <pattern
            id="crustTexture"
            x="0"
            y="0"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="5" cy="5" r="1.5" fill="rgba(139, 69, 19, 0.3)" />
          </pattern>
        </defs>

        {/* Outer crust - animated entry */}
        <motion.circle
          cx="150"
          cy="150"
          r="145"
          fill="#D2691E"
          filter="url(#shadow)"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, ease: "backOut" }}
        />
        <circle
          cx="150"
          cy="150"
          r="145"
          fill="url(#crustTexture)"
        />

        {/* Pizza slices with AnimatePresence for smooth transitions */}
        <AnimatePresence mode="sync">
          {slices.map((slice, index) => (
            <motion.g
              key={slice.id}
              initial={{ 
                opacity: 0,
                scale: 0,
                transformOrigin: "150px 150px"
              }}
              animate={{ 
                opacity: 1,
                scale: 1,
                transformOrigin: "150px 150px"
              }}
              exit={{ 
                opacity: 0,
                scale: 0,
                transformOrigin: "150px 150px"
              }}
              transition={{
                duration: 0.4,
                delay: index * 0.08,
                ease: "backOut"
              }}
            >
              {/* Slice fill */}
              <motion.path
                d={slice.pathData}
                fill={slice.color}
                stroke="#8B4513"
                strokeWidth="2"
                opacity="0.9"
                whileHover={{ 
                  opacity: 1,
                  scale: 1.05,
                  transformOrigin: "150px 150px"
                }}
                transition={{ duration: 0.2 }}
              />
              
              {/* Slice separator line */}
              <path
                d={slice.pathData}
                fill="none"
                stroke="white"
                strokeWidth="1"
                opacity="0.6"
              />

              {/* Slice number badge - animated */}
              <motion.g
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ 
                  duration: 0.3,
                  delay: index * 0.08 + 0.2,
                  ease: "backOut"
                }}
              >
                <circle
                  cx={slice.labelX}
                  cy={slice.labelY}
                  r="18"
                  fill="white"
                  stroke={slice.color}
                  strokeWidth="2"
                  filter="url(#shadow)"
                />
                <text
                  x={slice.labelX}
                  y={slice.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-xs font-bold"
                  fill={slice.color}
                >
                  {index + 1}
                </text>
              </motion.g>
            </motion.g>
          ))}
        </AnimatePresence>

        {/* Center circle for aesthetics - animated */}
        <motion.circle
          cx="150"
          cy="150"
          r="25"
          fill="#FFE4B5"
          stroke="#D2691E"
          strokeWidth="2"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ 
            duration: 0.4,
            delay: slices.length * 0.08 + 0.3,
            ease: "backOut"
          }}
        />
      </svg>

      {/* Legend below pizza - animated list */}
      <motion.div 
        className="mt-4 space-y-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <AnimatePresence mode="popLayout">
          {slices.map((slice, index) => (
            <motion.div
              key={slice.id}
              className="flex items-center gap-2 text-sm"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{
                duration: 0.3,
                delay: index * 0.05
              }}
              layout
            >
              <motion.div
                className="w-4 h-4 rounded-full border-2 flex-shrink-0"
                style={{
                  backgroundColor: slice.color,
                  borderColor: slice.color,
                }}
                whileHover={{ scale: 1.2 }}
                transition={{ duration: 0.2 }}
              />
              <span className="font-medium text-xs">
                {index + 1}. {slice.name}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Info badge - animated */}
      {flavors.length < maxFlavors && (
        <motion.div 
          className="mt-3 text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          <span className="text-xs text-muted-foreground">
            Você pode adicionar mais {maxFlavors - flavors.length} sabor
            {maxFlavors - flavors.length > 1 ? "es" : ""}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
