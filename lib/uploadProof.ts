import { supabase } from 'lib/supabase';

export type DeliveryProofUpload = {
  path: string;
  signedUrl: string | null;
};

function assertSupabaseConfigured() {
  if (!supabase) {
    throw new Error('Supabase is niet geconfigureerd.');
  }

  return supabase;
}

export async function uploadDeliveryProof(deliveryId: string, file: Blob): Promise<DeliveryProofUpload> {
  const client = assertSupabaseConfigured();
  const safeDeliveryId = deliveryId.replace(/[^a-zA-Z0-9-]/g, '');
  const fileName = `${safeDeliveryId}/${Date.now()}.jpg`;

  const { data, error } = await client.storage.from('delivery-proof').upload(fileName, file, {
    contentType: 'image/jpeg',
    upsert: false,
  });

  if (error) {
    throw error;
  }

  const path = data.path;
  const { data: signed } = await client.storage.from('delivery-proof').createSignedUrl(path, 60 * 10);

  return {
    path,
    signedUrl: signed?.signedUrl ?? null,
  };
}

export async function createDeliveryProofSignedUrl(path: string) {
  const client = assertSupabaseConfigured();
  const { data, error } = await client.storage.from('delivery-proof').createSignedUrl(path, 60 * 10);
  if (error) {
    throw error;
  }
  return data.signedUrl;
}
