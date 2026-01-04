"use client"
import React from "react"
import { tva } from "@gluestack-ui/nativewind-utils/tva"
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient"
import { cssInterop } from "nativewind"

cssInterop(ExpoLinearGradient, {
  className: "style",
})

const linearGradientStyle = tva({
  base: "",
  variants: {
    variant: {
      'gra-01': 'linear-gradient(106.45deg, rgb(var(--m-01--light-01)) 8.47%, rgb(var(--m-02--dark-01)) 92.4%)'
    }
  }
})

export const LinearGradient = React.forwardRef(
  ({ className, ...props }: any, ref?: any) => {
    return (
      <ExpoLinearGradient
        {...props}
        className={linearGradientStyle({ class: className })}
        ref={ref}
      />
    ) 
  }
)