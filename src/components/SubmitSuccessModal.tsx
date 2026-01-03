import React from 'react';
import { Modal, View, Text, Pressable } from 'react-native';

export function SubmitSuccessModal({ visible, onOk }: { visible: boolean; onOk: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 8, maxWidth: 420, width: '90%' }}>
          <Text testID="submit-success-text" style={{ marginBottom: 12, color: '#333' }}>
            Votre spot a été soumis. Il est en attente de modération. Si vous avez indiqué un mail de suivi vous recevrez des mises à jour.
          </Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Pressable testID="submit-success-ok" onPress={onOk} style={{ backgroundColor: '#0b3d91', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 }}>
              <Text style={{ color: 'white', fontWeight: '600' }}>OK</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
