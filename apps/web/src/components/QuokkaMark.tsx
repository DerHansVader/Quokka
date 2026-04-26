interface Props {
  size?: number;
}

export function QuokkaMark({ size = 16 }: Props) {
  return (
    <img
      src="/quokka-logo.svg"
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
    />
  );
}
