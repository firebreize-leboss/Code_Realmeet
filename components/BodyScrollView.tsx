echo "Dans app/activity-detail.tsx, supprimer le View spacer à la fin du ScrollView (la ligne avec le commentaire "Spacer pour le footer fixe" et le View avec paddingBottom) car le paddingBottom est déjà appliqué dans contentContainerStyle, et ce doublon cause l'écart excessif en bas" | claude --print --model opus --tools default --permission-mode acceptEdits --add-dir /home/ubuntu/realmeet/
import { forwardRef } from "react";
import { ScrollView, ScrollViewProps } from "react-native";

export const BodyScrollView = forwardRef<any, ScrollViewProps>((props, ref) => {
  return (
    <ScrollView
      automaticallyAdjustsScrollIndicatorInsets
      contentInsetAdjustmentBehavior="automatic"
      contentInset={{ bottom: 0 }}
      scrollIndicatorInsets={{ bottom: 0 }}
      {...props}
      ref={ref}
    />
  );
});
