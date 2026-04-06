import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Button,
} from '@react-email/components';

interface OrderConfirmationProps {
  customerName: string;
  orderId: string;
  merchantName: string;
  orderTotal: string;
  trackingUrl: string;
  lineItems: Array<{ name: string; qty: number; price: string }>;
}

export function OrderConfirmationEmail({
  customerName,
  orderId,
  merchantName,
  orderTotal,
  trackingUrl,
  lineItems,
}: OrderConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>Your order from {merchantName} is confirmed!</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f7f6f2' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
          <Heading>Order Confirmed 🎉</Heading>
          <Text>Hi {customerName}, your order #{orderId} from <strong>{merchantName}</strong> has been confirmed.</Text>
          <Hr />
          <Section>
            {lineItems.map((item, index) => (
              <Text key={`${item.name}-${index}`}>
                {item.name} × {item.qty} — {item.price}
              </Text>
            ))}
          </Section>
          <Hr />
          <Text><strong>Total: {orderTotal}</strong></Text>
          <Button href={trackingUrl} style={{ background: '#01696f', color: '#fff', padding: '12px 24px', borderRadius: '6px' }}>
            Track Your Order
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
