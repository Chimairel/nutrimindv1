import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToStream } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#1B4332' },
  section: { marginBottom: 15 },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#2D6A4F' },
  text: { fontSize: 12, marginBottom: 4, color: '#333333', lineHeight: 1.4 },
  listItem: { fontSize: 12, marginBottom: 4, marginLeft: 10, color: '#333333' },
  bold: { fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#D8F3DC', marginVertical: 15 },
  categoryHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
    color: '#1B4332',
    backgroundColor: '#D8F3DC',
    padding: 4,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  checkbox: { width: 12, height: 12, border: '1pt solid #1B4332', marginRight: 8 },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 10,
    textAlign: 'center',
    color: '#999999',
  },
});

const parseJsonArray = (data: any): string[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  try {
    const parsed = JSON.parse(data as string);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const NutritionReportPDF = ({ user, report }: { user: any; report: any }) => {
  const foodsToAvoid = parseJsonArray(report.foodsToAvoid);
  const foodsToLimit = parseJsonArray(report.foodsToLimit);
  const foodsRecommended = parseJsonArray(report.foodsRecommended);
  const drinksGuidance = parseJsonArray(report.drinksGuidance);
  const conditions = parseJsonArray(report.basedOnConditions);
  const allergies = parseJsonArray(report.basedOnAllergies);

  if (report.reportPolicyVersion && Array.isArray(report.referenceItems)) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.header}>KAINARA Nutrition Guidance</Text>
          <Text style={styles.text}>Version {report.version} | Prepared {new Date(report.generatedAt).toLocaleDateString()}</Text>
          <View style={styles.divider} />
          <Text style={styles.text}>Name: {user.name}</Text>
          <Text style={styles.text}>Estimated energy target: {user.userProfile?.dailyCalorieTarget || 'TBD'} kcal/day</Text>
          <Text style={styles.text}>Reported conditions: {conditions.length ? conditions.join(', ') : 'None reported'}</Text>
          <Text style={styles.text}>Reported food restrictions: {allergies.length ? allergies.join(', ') : 'None reported'}</Text>
          <View style={styles.divider} />
          <Text style={styles.title}>What these numbers mean</Text>
          <Text style={styles.text}>{report.generalSummary}</Text>
          {report.referenceItems.map((item: { heading: string; value: string; explanation: string; sourceTitle: string; sourceUrl: string }, index: number) => (
            <View key={index} style={styles.section} wrap={false}>
              <Text style={styles.title}>{item.heading}: {item.value}</Text>
              <Text style={styles.text}>{item.explanation}</Text>
              <Text style={styles.text}>Source: {item.sourceTitle}</Text>
              <Text style={styles.text}>{item.sourceUrl}</Text>
            </View>
          ))}
          <Text style={styles.text}>Acknowledgment records review of this document. Meal eligibility and Registered Nutritionist-Dietitian review are separate checks.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>KAINARA Personalized Nutrition Guidance</Text>

        <View style={styles.section}>
          <Text style={styles.text}>
            <Text style={styles.bold}>Patient Name:</Text> {user.name}
          </Text>
          <Text style={styles.text}>
            <Text style={styles.bold}>Daily Target:</Text> {user.userProfile?.dailyCalorieTarget || 'TBD'} kcal
          </Text>
          <Text style={styles.text}>
            <Text style={styles.bold}>Conditions Considered:</Text>{' '}
            {conditions.length > 0 ? conditions.join(', ') : 'None'}
          </Text>
          <Text style={styles.text}>
            <Text style={styles.bold}>Food Restrictions Considered:</Text>{' '}
            {allergies.length > 0 ? allergies.join(', ') : 'None'}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.title}>General Summary</Text>
          <Text style={styles.text}>{report.generalSummary}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Recommended Foods</Text>
          {foodsRecommended.map((item, i) => (
            <Text key={i} style={styles.listItem}>
              • {item}
            </Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Foods to Limit</Text>
          {foodsToLimit.map((item, i) => (
            <Text key={i} style={styles.listItem}>
              • {item}
            </Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Foods to Strictly Avoid</Text>
          {foodsToAvoid.map((item, i) => (
            <Text key={i} style={styles.listItem}>
              • {item}
            </Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Drinks & Hydration Guidance</Text>
          {drinksGuidance.map((item, i) => (
            <Text key={i} style={styles.listItem}>
              • {item}
            </Text>
          ))}
        </View>

        <Text style={styles.footer}>
          Archived guidance from a prior report version. Review your current guidance for up-to-date references.
        </Text>
      </Page>
    </Document>
  );
};

export const GroceryListPDF = ({
  groceryList,
  incomplete = false,
  unresolvedSlotCount = 0,
}: {
  groceryList: any;
  incomplete?: boolean;
  unresolvedSlotCount?: number;
}) => {
  // Group by category
  const grouped = groceryList.groceryItems.reduce((acc: any, item: any) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>KAINARA Grocery List</Text>
        <Text style={styles.text}>
          <Text style={styles.bold}>Week:</Text> {groceryList.weekLabel}
        </Text>
        {incomplete ? (
          <Text style={styles.text}>
            INCOMPLETE LIST — {unresolvedSlotCount} meal slot{unresolvedSlotCount === 1 ? '' : 's'} not included.
          </Text>
        ) : null}

        <View style={styles.divider} />

        {categories.map((cat) => (
          <View key={cat} style={styles.section}>
            <Text style={styles.categoryHeader}>{cat}</Text>
            {grouped[cat].map((item: any, i: number) => (
              <View key={i} style={styles.checkboxRow}>
                <View style={styles.checkbox} />
                <Text style={styles.text}>
                  {item.ingredientName}
                  {item.quantity !== null && item.unit
                    ? ` — ${Math.max(0, item.quantity - (item.purchasedQuantity ?? 0))} ${item.unit} to buy (${item.purchasedQuantity ?? 0} purchased / ${item.quantity} needed)`
                    : ''}
                  {item.isPantryStaple ? ' (pantry)' : ''}
                </Text>
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.footer}>Generated by KAINARA</Text>
      </Page>
    </Document>
  );
};

export const streamPdf = async (document: any) => {
  return renderToStream(document);
};
