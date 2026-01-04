import { cn } from '@/utils/misc';
import { ChevronDown } from 'lucide-react-native';
import * as AccordionPrimitive from '@rn-primitives/accordion';
import * as React from 'react';
import { Platform, Pressable, View } from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOutUp,
  FadingTransition,
  LayoutAnimationConfig,
  LinearTransition,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { TextClassContext } from './text';
import { LinearGradient } from 'expo-linear-gradient';


const Accordion = React.forwardRef<AccordionPrimitive.RootRef, AccordionPrimitive.RootProps>(
  ({ children, ...props }, ref) => {
    return (
      <LayoutAnimationConfig skipEntering>
        <AccordionPrimitive.Root ref={ref} {...props} asChild={Platform.OS !== 'web'}>
          <Animated.View layout={LinearTransition.duration(200)}>{children}</Animated.View>
        </AccordionPrimitive.Root>
      </LayoutAnimationConfig>
    );
  }
);

Accordion.displayName = AccordionPrimitive.Root.displayName;

const AccordionItem = React.forwardRef<AccordionPrimitive.ItemRef, AccordionPrimitive.ItemProps>(
  ({ className, value, ...props }, ref) => {
    return (
      <Animated.View className={'overflow-hidden'} layout={LinearTransition.duration(200)}>
        <AccordionPrimitive.Item
          ref={ref}
          className={cn('border-b border-border', className)}
          value={value}
          {...props}
        />
      </Animated.View>
    );
  }
);
AccordionItem.displayName = AccordionPrimitive.Item.displayName;

const Trigger = Platform.OS === 'web' ? View : Pressable;

const AccordionTrigger = React.forwardRef<
  AccordionPrimitive.TriggerRef,
  AccordionPrimitive.TriggerProps
>(({ className, children, ...props }, ref) => {
  const { isExpanded } = AccordionPrimitive.useItemContext();

  const progress = useDerivedValue(() =>
    isExpanded ? withTiming(1, { duration: 250 }) : withTiming(0, { duration: 200 })
  );
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
    opacity: interpolate(progress.value, [0, 1], [1, 0.8], Extrapolation.CLAMP),
  }));

  return (
    <TextClassContext.Provider value='native:text-lg font-medium web:group-hover:underline'>
      <AccordionPrimitive.Header className='flex h-40'>
        <AccordionPrimitive.Trigger ref={ref} {...props} asChild>
          <Trigger
            className={cn(
              'flex flex-row web:flex-1 items-center justify-between py-4 web:transition-all group web:focus-visible:outline-none web:focus-visible:ring-1 web:focus-visible:ring-muted-foreground relative flex-1 rounded-1/2  before:content-[""] before:rounded-1/2 dark:shadow-sha-06 dark:before:border-neu-10 box-border shadow-sha-01 will-change-transform before:shadow-sha-01 before:absolute before:left-1/2 before:top-1/2  before:-translate-x-1/2 before:-translate-y-1/2 before:border-2 before:border-neu-01 before:flex-1 before:w-full before:h-full',
              isExpanded ? 'dark:before:border-m-01--light-03  before:shadow-sha-06 before:absolute before:left-1/2 before:top-1/2  before:-translate-x-1/2 before:-translate-y-1/2 before:border-2 before:border-neu-01 before:flex-1 before:w-full before:h-full before:bg-gra-01': '',
              className
            )}
          >
            <View className="relative flex-1">
              {Platform.OS === 'web' ? (
                <View className="absolute inset-0 z-[-1] bg-gra-01 opacity-0 data-[state=open]:opacity-100 transition-opacity" />
              ) : (
                <LinearGradient
                  colors={['rgb(255, 255, 255)', 'rgb(240, 241, 241)', 'rgb(255, 255, 255)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="absolute inset-0 z-[-1] opacity-0 data-[state=open]:opacity-100"
                />
              )}
              {typeof children === 'function' ? children({ pressed: false, hovered: false }) : children}
            </View> 
            <Animated.View style={chevronStyle}>
              <ChevronDown size={18} className={'text-foreground shrink-0'} />
            </Animated.View>
          </Trigger>
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
    </TextClassContext.Provider>
  );
});
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
  AccordionPrimitive.ContentRef,
  AccordionPrimitive.ContentProps
>(({ className, children, ...props }, ref) => {
  const { isExpanded } = AccordionPrimitive.useItemContext();
  return (
    <TextClassContext.Provider value='native:text-lg'>
      <AccordionPrimitive.Content
        className={cn(
          'overflow-hidden text-sm web:transition-all',
          isExpanded ? 'web:animate-accordion-down' : 'web:animate-accordion-up'
        )}
        ref={ref}
        {...props}
      >
        <InnerContent className={cn('pb-4', className)}>{children}</InnerContent>
      </AccordionPrimitive.Content>
    </TextClassContext.Provider>
  );
});

function InnerContent({ children, className }: { children: React.ReactNode; className?: string }) {
  if (Platform.OS === 'web') {
    return <View className={cn('pb-4', className)}>{children}</View>;
  }
  return (
    <Animated.View
      entering={FadeIn.duration(300).delay(100)}
      exiting={FadeOutUp.duration(200)}
      layout={LinearTransition.duration(300)}
      className={cn('pb-4', className)}
    >
      {children}
    </Animated.View>
  );
}

AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };