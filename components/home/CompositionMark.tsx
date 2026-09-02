type CompositionMarkProps = {
  className?: string;
  variant:
    | "aperture"
    | "curve"
    | "focus"
    | "meter"
    | "perspective"
    | "radial"
    | "sensor"
    | "spiral"
    | "thirds"
    | "triangles"
    | "tunnel"
    | "v"
    | "waveform";
};

export function CompositionMark({ className = "", variant }: CompositionMarkProps) {
  const classes = `rr-vector-mark rr-vector-${variant} ${className}`.trim();

  return (
    <svg aria-hidden="true" className={classes} viewBox="0 0 600 400">
      {variant === "thirds" && (
        <>
          <rect x="16" y="16" width="568" height="368" rx="7" />
          <path d="M205 16v368M395 16v368M16 139h568M16 261h568" />
          <circle cx="205" cy="139" r="7" />
          <circle cx="395" cy="261" r="7" />
        </>
      )}

      {variant === "spiral" && (
        <>
          <rect x="16" y="16" width="568" height="368" rx="7" />
          <path d="M367 16v368M367 157h217M501 157v227M367 297h134M450 297v87" />
          <path d="M16 384C16 181 181 16 384 16c111 0 200 90 200 200 0 93-75 168-168 168-77 0-140-63-140-140 0-64 52-116 116-116 53 0 96 43 96 96 0 44-36 80-80 80-36 0-66-30-66-66 0-30 24-54 54-54" />
        </>
      )}

      {variant === "triangles" && (
        <>
          <rect x="16" y="16" width="568" height="368" rx="7" />
          <path d="M16 384 584 16M16 16l248 368M584 384 398 16" />
          <circle cx="300" cy="200" r="9" />
        </>
      )}

      {variant === "radial" && (
        <>
          <rect x="16" y="16" width="568" height="368" rx="7" />
          <path d="M300 200 16 16M300 200 110 16M300 200 205 16M300 200 300 16M300 200 395 16M300 200 490 16M300 200 584 16M300 200 584 108M300 200 584 200M300 200 584 292M300 200 584 384M300 200 490 384M300 200 395 384M300 200 300 384M300 200 205 384M300 200 110 384M300 200 16 384M300 200 16 292M300 200 16 200M300 200 16 108" />
          <circle cx="300" cy="200" r="31" />
        </>
      )}

      {variant === "aperture" && (
        <>
          <circle cx="300" cy="200" r="174" />
          <circle cx="300" cy="200" r="126" />
          <path d="m300 74 109 63-1 126-108 63-109-63 1-126Z" />
          <path d="m300 74-1 126 109-63M409 137l-110 63 109 63M408 263l-109-63 1 126M300 326l-1-126-108 63M191 263l108-63-107-63M192 137l107 63 1-126" />
        </>
      )}

      {variant === "tunnel" && (
        <>
          <rect x="16" y="16" width="568" height="368" rx="7" />
          <rect x="92" y="65" width="416" height="270" />
          <rect x="165" y="112" width="270" height="176" />
          <rect x="232" y="154" width="136" height="92" />
          <path d="M16 16l216 138M584 16 368 154M16 384l216-138M584 384 368 246" />
        </>
      )}

      {variant === "curve" && (
        <>
          <rect x="16" y="16" width="568" height="368" rx="7" />
          <path d="M96 334c323 0 379-269 135-269-183 0-185 187 32 187 136 0 209-78 246-187" />
          <path d="M81 65c72 0 112 39 151 91s76 99 173 99c53 0 91-19 124-54" />
          <circle cx="232" cy="156" r="8" />
          <circle cx="405" cy="255" r="8" />
        </>
      )}

      {variant === "v" && (
        <>
          <rect x="16" y="16" width="568" height="368" rx="7" />
          <path d="m102 16 198 368L498 16M16 100l284 284 284-284" />
          <path d="M300 16v368M16 200h568" />
          <circle cx="300" cy="384" r="9" />
        </>
      )}

      {variant === "focus" && (
        <>
          <circle cx="300" cy="200" r="168" />
          <circle cx="300" cy="200" r="105" />
          <circle cx="300" cy="200" r="34" />
          <path d="M300 8v92M300 300v92M108 200h92M400 200h92" />
          <path d="M170 70h-58v58M430 70h58v58M170 330h-58v-58M430 330h58v-58" />
          <path d="m285 200 10 10 22-28" />
        </>
      )}

      {variant === "sensor" && (
        <>
          <rect x="34" y="48" width="532" height="304" rx="10" />
          <rect x="76" y="80" width="448" height="240" rx="4" />
          <path d="M188 80v240M300 80v240M412 80v240M76 140h448M76 200h448M76 260h448" />
          <path d="M54 30v36M36 48h36M546 30v36M528 48h36M54 334v36M36 352h36M546 334v36M528 352h36" />
          <circle cx="300" cy="200" r="13" />
        </>
      )}

      {variant === "perspective" && (
        <>
          <path d="M18 200h564M300 200 18 28M300 200 102 28M300 200 196 28M300 200 404 28M300 200 498 28M300 200 582 28" />
          <path d="M300 200 18 372M300 200 102 372M300 200 196 372M300 200 404 372M300 200 498 372M300 200 582 372" />
          <path d="M96 76h408M151 124h298M205 163h190M205 237h190M151 276h298M96 324h408" />
          <circle cx="300" cy="200" r="9" />
        </>
      )}

      {variant === "meter" && (
        <>
          <path d="M66 294a252 252 0 0 1 468 0" />
          <path d="M95 280l-25 12M125 226l-29-7M170 178l-22-21M226 145l-9-29M300 133V98M374 145l9-29M430 178l22-21M475 226l29-7M505 280l25 12" />
          <path d="M300 292 418 165" />
          <circle cx="300" cy="292" r="18" />
          <path d="M174 334h252M268 360h64" />
        </>
      )}

      {variant === "waveform" && (
        <>
          <rect x="18" y="28" width="564" height="344" rx="7" />
          <path d="M18 114h564M18 200h564M18 286h564M112 28v344M206 28v344M300 28v344M394 28v344M488 28v344" />
          <path d="M18 291c34 0 34-63 67-63s33 37 66 37 33-151 66-151 33 198 66 198 33-223 67-223 34 164 67 164 33-70 66-70 33 108 66 108 33-46 83-46" />
          <path d="M18 244c52 0 48-92 98-92 40 0 46 84 88 84 48 0 46-54 94-54s49 89 96 89 45-131 92-131c44 0 46 104 96 104" />
        </>
      )}
    </svg>
  );
}
